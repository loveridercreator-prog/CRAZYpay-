package com.crazypay.app.data.local.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "trades")
data class TradeEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    @ColumnInfo(name = "order_id")
    val orderId: String,
    @ColumnInfo(name = "trade_type")
    val tradeType: String, // BUY or SELL
    @ColumnInfo(name = "buyer_id")
    val buyerId: String,
    @ColumnInfo(name = "seller_id")
    val sellerId: String,
    @ColumnInfo(name = "seller_name")
    val sellerName: String,
    @ColumnInfo(name = "asset")
    val asset: String = "USDT",
    @ColumnInfo(name = "asset_amount")
    val assetAmount: Double,
    @ColumnInfo(name = "fiat_currency")
    val fiatCurrency: String = "INR",
    @ColumnInfo(name = "fiat_amount")
    val fiatAmount: Double,
    @ColumnInfo(name = "exchange_rate")
    val exchangeRate: Double = 91.50,
    @ColumnInfo(name = "payment_method")
    val paymentMethod: String = "UPI",
    @ColumnInfo(name = "bound_payment_identifier")
    val boundPaymentIdentifier: String,
    @ColumnInfo(name = "submitted_utr")
    val submittedUtr: String? = null,
    @ColumnInfo(name = "status")
    val status: String = "MATCHED", // OPEN, MATCHED, PAYMENT_PENDING, PAYMENT_DETECTED, VERIFICATION_PENDING, VERIFIED, COMPLETED, CANCELLED, DISPUTED
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "expires_at")
    val expiresAt: Long = System.currentTimeMillis() + (15 * 60 * 1000), // 15-minute countdown
    @ColumnInfo(name = "completed_at")
    val completedAt: Long? = null
)
