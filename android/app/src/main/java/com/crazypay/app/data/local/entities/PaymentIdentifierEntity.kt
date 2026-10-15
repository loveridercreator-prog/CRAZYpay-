package com.crazypay.app.data.local.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "payment_identifiers")
data class PaymentIdentifierEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    @ColumnInfo(name = "user_id")
    val userId: String,
    @ColumnInfo(name = "identifier_type")
    val identifierType: String, // UPI_ID, UPI_NUMBER, BANK_ACCOUNT
    @ColumnInfo(name = "identifier_value")
    val identifierValue: String, // e.g. trader99@okaxis
    @ColumnInfo(name = "account_holder_name")
    val accountHolderName: String,
    @ColumnInfo(name = "is_active_binding")
    val isActiveBinding: Boolean = false, // Single Active Binding Rule
    @ColumnInfo(name = "status")
    val status: String = "ACTIVE", // ACTIVE, UNVERIFIED, SUSPENDED
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)
