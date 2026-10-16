package com.crazypay.app.data.model

import java.io.Serializable

data class User(
    val phone: String,
    val name: String = "CrazyPay Trader",
    val balance: Double = 0.0,
    val usdtBalance: Double = 0.0,
    val todayProfit: Double = 0.0,
    val totalCommission: Double = 0.0,
    val referralCode: String = "",
    val isLoggedIn: Boolean = true,
    val isNewUser: Boolean = false,
    val teamSize: Int = 0,
    val role: String = "user",
    val kycStatus: String = "TIER_2_VERIFIED",
    val joinedTimestamp: Long = System.currentTimeMillis()
) : Serializable
