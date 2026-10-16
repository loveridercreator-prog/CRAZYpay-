package com.crazypay.app.data.model

import java.io.Serializable

enum class OrderStatus {
    PENDING,
    PAID,
    RELEASED,
    COMPLETED,
    CANCELLED,
    DISPUTED
}

enum class OrderType {
    BUY,
    SELL
}

data class P2pOrder(
    val id: String,
    val orderType: OrderType = OrderType.BUY,
    val amountInr: Double,
    val amountUsdt: Double,
    val priceRate: Double = 91.50,
    val sellerName: String = "Verified Merchant",
    val sellerPhone: String = "",
    val sellerUpiId: String = "crazypay.merchant@okhdfcbank",
    val buyerPhone: String = "",
    val buyerUpiId: String = "",
    val status: OrderStatus = OrderStatus.PENDING,
    val utrNumber: String = "",
    val paymentGateway: String = "Google Pay",
    val timestamp: Long = System.currentTimeMillis(),
    val expiresAt: Long = System.currentTimeMillis() + (15 * 60 * 1000)
) : Serializable
