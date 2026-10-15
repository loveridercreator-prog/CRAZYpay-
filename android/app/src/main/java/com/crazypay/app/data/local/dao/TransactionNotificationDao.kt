package com.crazypay.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.crazypay.app.data.local.entities.TransactionNotificationEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface TransactionNotificationDao {
    @Query("SELECT * FROM transaction_notifications ORDER BY received_at DESC")
    fun getAllNotificationsFlow(): Flow<List<TransactionNotificationEntity>>

    @Query("SELECT * FROM transaction_notifications WHERE utr = :utr LIMIT 1")
    suspend fun findByUtr(utr: String): TransactionNotificationEntity?

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertNotification(notification: TransactionNotificationEntity): Long

    @Update
    suspend fun updateNotification(notification: TransactionNotificationEntity)
}
