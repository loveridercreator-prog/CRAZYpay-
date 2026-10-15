package com.crazypay.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.crazypay.app.data.local.entities.TradeEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface TradeDao {
    @Query("SELECT * FROM trades ORDER BY createdAt DESC")
    fun getAllTradesFlow(): Flow<List<TradeEntity>>

    @Query("SELECT * FROM trades WHERE order_id = :orderId LIMIT 1")
    suspend fun getTradeByOrderId(orderId: String): TradeEntity?

    @Query("SELECT * FROM trades WHERE status IN ('MATCHED', 'PAYMENT_PENDING', 'PAYMENT_DETECTED', 'VERIFICATION_PENDING') ORDER BY createdAt DESC LIMIT 1")
    suspend fun getActivePendingTrade(): TradeEntity?

    @Query("SELECT * FROM trades WHERE fiat_amount = :amount AND status IN ('MATCHED', 'PAYMENT_PENDING', 'PAYMENT_DETECTED') LIMIT 1")
    suspend fun findMatchingTradeForAmount(amount: Double): TradeEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTrade(trade: TradeEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTrades(trades: List<TradeEntity>)

    @Update
    suspend fun updateTrade(trade: TradeEntity)

    @Query("UPDATE trades SET status = :status, submitted_utr = :utr, completed_at = :completedAt WHERE order_id = :orderId")
    suspend fun updateTradeStatus(orderId: String, status: String, utr: String?, completedAt: Long?)
}
