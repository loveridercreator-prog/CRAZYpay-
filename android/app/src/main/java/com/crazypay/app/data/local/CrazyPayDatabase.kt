package com.crazypay.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.crazypay.app.data.local.dao.PaymentIdentifierDao
import com.crazypay.app.data.local.dao.TradeDao
import com.crazypay.app.data.local.dao.TransactionNotificationDao
import com.crazypay.app.data.local.dao.UserDao
import com.crazypay.app.data.local.entities.AuditLogEntity
import com.crazypay.app.data.local.entities.PaymentIdentifierEntity
import com.crazypay.app.data.local.entities.TradeEntity
import com.crazypay.app.data.local.entities.TransactionNotificationEntity
import com.crazypay.app.data.local.entities.UserEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.UUID

@Database(
    entities = [
        UserEntity::class,
        TradeEntity::class,
        PaymentIdentifierEntity::class,
        TransactionNotificationEntity::class,
        AuditLogEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class CrazyPayDatabase : RoomDatabase() {

    abstract fun userDao(): UserDao
    abstract fun tradeDao(): TradeDao
    abstract fun paymentIdentifierDao(): PaymentIdentifierDao
    abstract fun transactionNotificationDao(): TransactionNotificationDao

    companion object {
        @Volatile
        private var INSTANCE: CrazyPayDatabase? = null

        fun getDatabase(context: Context): CrazyPayDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    CrazyPayDatabase::class.java,
                    "crazypay_native.db"
                )
                    .fallbackToDestructiveMigration()
                    .addCallback(DatabaseCallback())
                    .build()
                INSTANCE = instance
                instance
            }
        }

        private class DatabaseCallback : RoomDatabase.Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                INSTANCE?.let { database ->
                    CoroutineScope(Dispatchers.IO).launch {
                        populateInitialData(database)
                    }
                }
            }

            private suspend fun populateInitialData(database: CrazyPayDatabase) {
                val defaultUserId = UUID.randomUUID().toString()

                // 1. Initial User
                val user = UserEntity(
                    id = defaultUserId,
                    mobile = "+91 98765 43210",
                    displayName = "Saloni P2P Pro",
                    role = "USER",
                    kycLevel = "TIER_2",
                    isVerified = true,
                    balanceInr = 25450.00,
                    balanceUsdt = 280.50,
                    inviteCode = "CRAZY8821"
                )
                database.userDao().insertUser(user)

                // 2. Bound UPI Identifiers (Enforcing single active binding)
                val primaryUpi = PaymentIdentifierEntity(
                    id = UUID.randomUUID().toString(),
                    userId = defaultUserId,
                    identifierType = "UPI_ID",
                    identifierValue = "saloni.pay@okaxis",
                    accountHolderName = "Saloni P2P Pro",
                    isActiveBinding = true,
                    status = "ACTIVE"
                )
                val secondaryUpi = PaymentIdentifierEntity(
                    id = UUID.randomUUID().toString(),
                    userId = defaultUserId,
                    identifierType = "UPI_NUMBER",
                    identifierValue = "9876543210@paytm",
                    accountHolderName = "Saloni P2P Pro",
                    isActiveBinding = false,
                    status = "ACTIVE"
                )
                database.paymentIdentifierDao().insertIdentifier(primaryUpi)
                database.paymentIdentifierDao().insertIdentifier(secondaryUpi)

                // 3. Demo Trades
                val trade1 = TradeEntity(
                    orderId = "CP-" + (100000..999999).random(),
                    tradeType = "BUY",
                    buyerId = defaultUserId,
                    sellerId = "MERCHANT-01",
                    sellerName = "ExpressFast Traders",
                    asset = "USDT",
                    assetAmount = 50.0,
                    fiatCurrency = "INR",
                    fiatAmount = 4575.00,
                    exchangeRate = 91.50,
                    paymentMethod = "UPI",
                    boundPaymentIdentifier = "express.fast@yesbank",
                    status = "MATCHED",
                    createdAt = System.currentTimeMillis() - (2 * 60 * 1000),
                    expiresAt = System.currentTimeMillis() + (13 * 60 * 1000)
                )

                val trade2 = TradeEntity(
                    orderId = "CP-883921",
                    tradeType = "SELL",
                    buyerId = "BUYER-88",
                    sellerId = defaultUserId,
                    sellerName = "Saloni P2P Pro",
                    asset = "USDT",
                    assetAmount = 100.0,
                    fiatCurrency = "INR",
                    fiatAmount = 9150.00,
                    exchangeRate = 91.50,
                    paymentMethod = "UPI",
                    boundPaymentIdentifier = "saloni.pay@okaxis",
                    submittedUtr = "428910394821",
                    status = "COMPLETED",
                    createdAt = System.currentTimeMillis() - (86400 * 1000),
                    completedAt = System.currentTimeMillis() - (85000 * 1000)
                )

                database.tradeDao().insertTrades(listOf(trade1, trade2))
            }
        }
    }
}
