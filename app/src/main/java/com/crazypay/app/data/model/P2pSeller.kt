package com.crazypay.app.data.model

import java.io.Serializable

data class P2pSeller(
    val id: String,
    val name: String,
    val rating: Double,
    val completionRate: Int, // e.g. 99%
    val totalOrders: Int,
    val priceRate: Double,
    val minLimit: Double,
    val maxLimit: Double,
    val upiId: String,
    val paymentMethods: List<String>,
    val isVerified: Boolean = true
) : Serializable
