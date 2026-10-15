package com.crazypay.app.data.local.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    @ColumnInfo(name = "mobile")
    val mobile: String,
    @ColumnInfo(name = "display_name")
    val displayName: String,
    @ColumnInfo(name = "role")
    val role: String = "USER", // USER, MERCHANT, ADMIN
    @ColumnInfo(name = "kyc_level")
    val kycLevel: String = "TIER_1", // TIER_1, TIER_2, TIER_3
    @ColumnInfo(name = "is_verified")
    val isVerified: Boolean = true,
    @ColumnInfo(name = "balance_inr")
    val balanceInr: Double = 25450.00,
    @ColumnInfo(name = "balance_usdt")
    val balanceUsdt: Double = 280.50,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "invite_code")
    val inviteCode: String = "CRAZY" + (1000..9999).random()
)
