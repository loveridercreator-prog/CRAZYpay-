package com.crazypay.app.data.local.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "transaction_notifications")
data class TransactionNotificationEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    @ColumnInfo(name = "utr")
    val utr: String,
    @ColumnInfo(name = "amount")
    val amount: Double,
    @ColumnInfo(name = "sender_header")
    val senderHeader: String,
    @ColumnInfo(name = "received_at")
    val receivedAt: Long,
    @ColumnInfo(name = "is_credit")
    val isCredit: Boolean = true,
    @ColumnInfo(name = "matched_trade_id")
    val matchedTradeId: String? = null,
    @ColumnInfo(name = "synced_to_server")
    val syncedToServer: Boolean = false
)
