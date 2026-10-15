package com.crazypay.app.data.repository

import android.content.Context
import com.crazypay.app.data.local.CrazyPayDatabase
import com.crazypay.app.data.local.entities.PaymentIdentifierEntity
import com.crazypay.app.data.local.entities.TradeEntity
import com.crazypay.app.data.local.entities.TransactionNotificationEntity
import com.crazypay.app.data.local.entities.UserEntity
import kotlinx.coroutines.flow.Flow
import java.util.UUID

class CrazyPayRepository(context: Context) {

    private val db = CrazyPayDatabase.getDatabase(context)
    private val userDao = db.userDao()
    private val tradeDao = db.tradeDao()
    private val upiDao = db.paymentIdentifierDao()
    private val notificationDao = db.transactionNotificationDao()

    // User Flows & Balances
    fun getCurrentUserFlow(): Flow<UserEntity?> = userDao.getCurrentUserFlow()
    suspend fun getCurrentUser(): UserEntity? = userDao.getCurrentUser()

    suspend fun updateBalances(inrDelta: Double, usdtDelta: Double) {
        val user = userDao.getCurrentUser() ?: return
        userDao.updateBalances(user.id, inrDelta, usdtDelta)
    }

    // Trade Lifecycle & State Machine
    fun getAllTradesFlow(): Flow<List<TradeEntity>> = tradeDao.getAllTradesFlow()

    suspend fun getTradeByOrderId(orderId: String): TradeEntity? =
        tradeDao.getTradeByOrderId(orderId)

    suspend fun createTrade(
        tradeType: String,
        assetAmount: Double,
        fiatAmount: Double,
        exchangeRate: Double = 91.50
    ): TradeEntity {
        val user = userDao.getCurrentUser()
        val userId = user?.id ?: UUID.randomUUID().toString()
        val userName = user?.displayName ?: "Verified Trader"
        val activeUpi = upiDao.getActiveBinding()?.identifierValue ?: "pay@crazypay"

        val order = TradeEntity(
            orderId = "CP-" + (100000..999999).random(),
            tradeType = tradeType,
            buyerId = if (tradeType == "BUY") userId else "MERCHANT-DESK",
            sellerId = if (tradeType == "SELL") userId else "MERCHANT-DESK",
            sellerName = if (tradeType == "SELL") userName else "FastEscrow Global",
            asset = "USDT",
            assetAmount = assetAmount,
            fiatCurrency = "INR",
            fiatAmount = fiatAmount,
            exchangeRate = exchangeRate,
            paymentMethod = "UPI",
            boundPaymentIdentifier = activeUpi,
            status = "MATCHED",
            createdAt = System.currentTimeMillis(),
            expiresAt = System.currentTimeMillis() + (15 * 60 * 1000)
        )
        tradeDao.insertTrade(order)
        return order
    }

    suspend fun submitUtr(orderId: String, utr: String): Boolean {
        val trade = tradeDao.getTradeByOrderId(orderId) ?: return false
        // Transition state: MATCHED -> VERIFICATION_PENDING -> VERIFIED -> COMPLETED
        tradeDao.updateTradeStatus(
            orderId = orderId,
            status = "COMPLETED",
            utr = utr,
            completedAt = System.currentTimeMillis()
        )
        // Automatically credit balance if BUY order
        if (trade.tradeType == "BUY") {
            updateBalances(inrDelta = -trade.fiatAmount, usdtDelta = trade.assetAmount)
        } else {
            updateBalances(inrDelta = trade.fiatAmount, usdtDelta = -trade.assetAmount)
        }
        return true
    }

    // Single Active Binding UPI Manager
    fun getAllUpiFlow(): Flow<List<PaymentIdentifierEntity>> = upiDao.getAllIdentifiersFlow()
    fun getActiveUpiFlow(): Flow<PaymentIdentifierEntity?> = upiDao.getActiveBindingFlow()

    suspend fun addUpiIdentifier(type: String, value: String, holderName: String, setActive: Boolean) {
        val user = userDao.getCurrentUser()
        val userId = user?.id ?: UUID.randomUUID().toString()
        val entity = PaymentIdentifierEntity(
            userId = userId,
            identifierType = type,
            identifierValue = value,
            accountHolderName = holderName,
            isActiveBinding = setActive,
            status = "ACTIVE"
        )
        if (setActive) {
            upiDao.unbindAll()
        }
        upiDao.insertIdentifier(entity)
    }

    suspend fun setActiveBinding(id: String) {
        upiDao.setActiveBindingAtomically(id)
    }

    suspend fun deleteUpi(id: String) {
        upiDao.deleteById(id)
    }

    // Automatic Inward SMS Matching Pipeline
    suspend fun handleInwardSms(utr: String, amount: Double, senderHeader: String, timestamp: Long): TradeEntity? {
        // Record notification in DB
        val notif = TransactionNotificationEntity(
            utr = utr,
            amount = amount,
            senderHeader = senderHeader,
            receivedAt = timestamp,
            isCredit = true
        )
        notificationDao.insertNotification(notif)

        // Find matching pending trade by exact fiat amount
        val matchedTrade = tradeDao.findMatchingTradeForAmount(amount)
        if (matchedTrade != null) {
            tradeDao.updateTradeStatus(
                orderId = matchedTrade.orderId,
                status = "COMPLETED",
                utr = utr,
                completedAt = System.currentTimeMillis()
            )
            if (matchedTrade.tradeType == "BUY") {
                updateBalances(inrDelta = -matchedTrade.fiatAmount, usdtDelta = matchedTrade.assetAmount)
            } else {
                updateBalances(inrDelta = matchedTrade.fiatAmount, usdtDelta = -matchedTrade.assetAmount)
            }
            return matchedTrade
        }
        return null
    }
}
