package com.crazypay.app.data.repository

import android.content.Context
import com.crazypay.app.data.local.PreferencesManager
import com.crazypay.app.data.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

class CrazyPayRepository(private val prefs: PreferencesManager) {

    constructor(context: Context) : this(PreferencesManager(context))

    private val _currentUser = MutableStateFlow<User?>(prefs.getCurrentUser())
    val currentUser: StateFlow<User?> = _currentUser.asStateFlow()

    private val _orders = MutableStateFlow<List<P2pOrder>>(emptyList())
    val orders: StateFlow<List<P2pOrder>> = _orders.asStateFlow()

    private val _upiHandles = MutableStateFlow<List<UpiHandle>>(emptyList())
    val upiHandles: StateFlow<List<UpiHandle>> = _upiHandles.asStateFlow()

    private val _systemConfig = MutableStateFlow<SystemConfig>(prefs.getSystemConfig())
    val systemConfig: StateFlow<SystemConfig> = _systemConfig.asStateFlow()

    fun handleInwardSms(utr: String, amount: Double, senderHeader: String, timestamp: Long) {
        val pendingOrder = _orders.value.find { 
            it.status == OrderStatus.PENDING && (Math.abs(it.amountInr - amount) < 1.0 || it.amountInr == amount) 
        }
        if (pendingOrder != null) {
            verifyUtr(pendingOrder.id, utr)
        }
    }

    init {
        loadInitialData()
    }

    private fun loadInitialData() {
        val savedOrders = prefs.getOrders()
        if (savedOrders.isNotEmpty()) {
            _orders.value = savedOrders
        } else {
            // Seed mock initial order for demonstration
            val initial = listOf(
                P2pOrder(
                    id = "ORD-94812",
                    orderType = OrderType.BUY,
                    amountInr = 5000.0,
                    amountUsdt = 54.64,
                    priceRate = 91.50,
                    sellerName = "Sunil_CryptoDesk",
                    sellerUpiId = "crazypay.escrow@icici",
                    status = OrderStatus.RELEASED,
                    utrNumber = "428910482910"
                )
            )
            _orders.value = initial
            prefs.saveOrders(initial)
        }

        val savedUpi = prefs.getUpiHandles()
        if (savedUpi.isNotEmpty()) {
            _upiHandles.value = savedUpi
        } else {
            val initialUpi = listOf(
                UpiHandle(
                    id = "upi_1",
                    upiId = "9708634584@paytm",
                    accountHolder = "Saloni Kumari",
                    provider = "Paytm",
                    isPrimary = true
                )
            )
            _upiHandles.value = initialUpi
            prefs.saveUpiHandles(initialUpi)
        }
    }

    // 1. Authentication
    fun login(phone: String, pass: String): Result<User> {
        val cleanPhone = phone.replace(Regex("[^0-9]"), "").takeLast(10)
        if (cleanPhone.length != 10) {
            return Result.failure(Exception("Please enter a valid 10-digit Indian phone number."))
        }
        if (pass.length < 4) {
            return Result.failure(Exception("Password must be at least 4 characters."))
        }

        val existing = prefs.getCurrentUser()
        val user = if (existing != null && existing.phone.endsWith(cleanPhone)) {
            existing.copy(isLoggedIn = true)
        } else {
            User(
                phone = cleanPhone,
                name = "Trader +91 $cleanPhone",
                balance = 300.0, // Initial bonus
                usdtBalance = 0.0,
                referralCode = "CP" + cleanPhone.takeLast(4),
                isLoggedIn = true
            )
        }

        prefs.saveCurrentUser(user)
        prefs.setRememberedPhone(cleanPhone)
        _currentUser.value = user
        return Result.success(user)
    }

    fun register(phone: String, pass: String, inviteCode: String): Result<User> {
        val cleanPhone = phone.replace(Regex("[^0-9]"), "").takeLast(10)
        if (cleanPhone.length != 10) {
            return Result.failure(Exception("Please enter a valid 10-digit mobile number."))
        }
        val user = User(
            phone = cleanPhone,
            name = "Trader +91 $cleanPhone",
            balance = _systemConfig.value.inrSignupReward,
            usdtBalance = 0.0,
            referralCode = "CP" + cleanPhone.takeLast(4),
            isLoggedIn = true,
            isNewUser = true
        )
        prefs.saveCurrentUser(user)
        prefs.setRememberedPhone(cleanPhone)
        _currentUser.value = user
        return Result.success(user)
    }

    fun logout() {
        prefs.clearSession()
        _currentUser.value = null
    }

    // 2. P2P Marketplace Sellers
    fun getMarketplaceSellers(): List<P2pSeller> {
        val currentRate = _systemConfig.value.usdtExchangeRate
        return listOf(
            P2pSeller(
                id = "s_1",
                name = "Aman_FastPay",
                rating = 4.98,
                completionRate = 100,
                totalOrders = 3412,
                priceRate = currentRate,
                minLimit = 500.0,
                maxLimit = 50000.0,
                upiId = "fastpay.aman@okhdfcbank",
                paymentMethods = listOf("Google Pay", "PhonePe", "Paytm")
            ),
            P2pSeller(
                id = "s_2",
                name = "Ramesh_OTC_Hub",
                rating = 4.95,
                completionRate = 99,
                totalOrders = 1890,
                priceRate = currentRate + 0.10,
                minLimit = 1000.0,
                maxLimit = 100000.0,
                upiId = "ramesh.otc@yesbank",
                paymentMethods = listOf("PhonePe", "IMPS")
            ),
            P2pSeller(
                id = "s_3",
                name = "Kunal_Direct_UPI",
                rating = 4.92,
                completionRate = 98,
                totalOrders = 920,
                priceRate = currentRate,
                minLimit = 300.0,
                maxLimit = 25000.0,
                upiId = "kunal.direct@ybl",
                paymentMethods = listOf("Paytm", "Google Pay")
            ),
            P2pSeller(
                id = "s_4",
                name = "MobiKwik_Official_Gate",
                rating = 5.0,
                completionRate = 100,
                totalOrders = 15420,
                priceRate = currentRate,
                minLimit = 500.0,
                maxLimit = 200000.0,
                upiId = "mobikwik.gateway@axl",
                paymentMethods = listOf("Google Pay", "PhonePe", "Paytm", "Direct Bank")
            )
        )
    }

    // 3. Orders & Escrow Operations
    fun createBuyOrder(amountInr: Double, seller: P2pSeller, gateway: String): Result<P2pOrder> {
        if (!_systemConfig.value.isServiceOnline) {
            return Result.failure(Exception("Platform service is currently offline for maintenance."))
        }
        val rate = seller.priceRate
        val usdtAmount = String.format("%.2f", amountInr / rate).toDouble()

        val newOrder = P2pOrder(
            id = "CP-" + System.currentTimeMillis().toString().takeLast(6),
            orderType = OrderType.BUY,
            amountInr = amountInr,
            amountUsdt = usdtAmount,
            priceRate = rate,
            sellerName = seller.name,
            sellerUpiId = seller.upiId,
            buyerPhone = _currentUser.value?.phone ?: "",
            status = OrderStatus.PENDING,
            paymentGateway = gateway
        )

        val updated = listOf(newOrder) + _orders.value
        _orders.value = updated
        prefs.saveOrders(updated)
        return Result.success(newOrder)
    }

    fun verifyUtr(orderId: String, utr: String): Result<P2pOrder> {
        val cleanUtr = utr.trim()
        if (cleanUtr.length != 12 || !cleanUtr.all { it.isDigit() }) {
            return Result.failure(Exception("Invalid UTR. Please enter a valid 12-digit numeric Bank Reference number."))
        }

        val order = _orders.value.find { it.id == orderId }
            ?: return Result.failure(Exception("Order not found."))

        val updatedOrder = order.copy(
            status = OrderStatus.RELEASED,
            utrNumber = cleanUtr
        )

        val updatedList = _orders.value.map { if (it.id == orderId) updatedOrder else it }
        _orders.value = updatedList
        prefs.saveOrders(updatedList)

        // Credit user USDT balance
        val user = _currentUser.value
        if (user != null) {
            val updatedUser = user.copy(
                usdtBalance = user.usdtBalance + order.amountUsdt,
                todayProfit = user.todayProfit + (order.amountUsdt * 1.5)
            )
            _currentUser.value = updatedUser
            prefs.saveCurrentUser(updatedUser)
        }

        return Result.success(updatedOrder)
    }

    // 4. Withdrawal / Sell USDT
    fun withdrawInr(amountInr: Double, upiId: String): Result<Boolean> {
        val user = _currentUser.value ?: return Result.failure(Exception("Please login first."))
        if (amountInr <= 0 || amountInr > user.balance) {
            return Result.failure(Exception("Insufficient INR balance."))
        }
        val updatedUser = user.copy(balance = user.balance - amountInr)
        _currentUser.value = updatedUser
        prefs.saveCurrentUser(updatedUser)
        return Result.success(true)
    }

    fun sellUsdt(amountUsdt: Double, receivingUpi: String): Result<P2pOrder> {
        val user = _currentUser.value ?: return Result.failure(Exception("Please login first."))
        if (amountUsdt <= 0 || amountUsdt > user.usdtBalance) {
            return Result.failure(Exception("Insufficient USDT balance."))
        }
        val rate = _systemConfig.value.usdtExchangeRate
        val inrAmount = amountUsdt * rate

        val updatedUser = user.copy(usdtBalance = user.usdtBalance - amountUsdt)
        _currentUser.value = updatedUser
        prefs.saveCurrentUser(updatedUser)

        val sellOrder = P2pOrder(
            id = "CP-SELL-" + System.currentTimeMillis().toString().takeLast(6),
            orderType = OrderType.SELL,
            amountInr = inrAmount,
            amountUsdt = amountUsdt,
            priceRate = rate,
            buyerUpiId = receivingUpi,
            status = OrderStatus.RELEASED
        )
        val updatedList = listOf(sellOrder) + _orders.value
        _orders.value = updatedList
        prefs.saveOrders(updatedList)

        return Result.success(sellOrder)
    }

    // 5. UPI Handles Binding
    fun bindUpi(upiId: String, holder: String, provider: String): Result<UpiHandle> {
        if (!upiId.contains("@")) {
            return Result.failure(Exception("Invalid UPI handle format (e.g. name@okaxis)."))
        }
        val newHandle = UpiHandle(
            id = "upi_" + UUID.randomUUID().toString().take(6),
            upiId = upiId,
            accountHolder = holder,
            provider = provider,
            isPrimary = true
        )
        // Mark others non-primary
        val updated = listOf(newHandle) + _upiHandles.value.map { it.copy(isPrimary = false) }
        _upiHandles.value = updated
        prefs.saveUpiHandles(updated)
        return Result.success(newHandle)
    }

    // 6. Arbitrage / Mining Pools
    fun getArbitragePools(): List<ArbitragePool> {
        return listOf(
            ArbitragePool(
                id = "arb_1",
                title = "Flash OTC High-Frequency Arbitrage",
                dailyRoi = 3.25,
                lockPeriodDays = 7,
                minDepositUsdt = 50.0,
                riskLevel = "Escrow Guaranteed"
            ),
            ArbitragePool(
                id = "arb_2",
                title = "Cross-Exchange Liquidity Sweep",
                dailyRoi = 4.80,
                lockPeriodDays = 15,
                minDepositUsdt = 200.0,
                riskLevel = "Multi-Signature Node"
            ),
            ArbitragePool(
                id = "arb_3",
                title = "Whale OTC Settlement Vault",
                dailyRoi = 6.10,
                lockPeriodDays = 30,
                minDepositUsdt = 500.0,
                riskLevel = "Principal Insured"
            )
        )
    }

    // 7. Admin Config
    fun updateSystemConfig(config: SystemConfig) {
        _systemConfig.value = config
        prefs.saveSystemConfig(config)
    }

    fun isPermissionAuthorized(): Boolean {
        return prefs.isPermissionGranted()
    }

    fun setPermissionAuthorized(granted: Boolean) {
        prefs.setPermissionGranted(granted)
    }
}
