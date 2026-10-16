package com.crazypay.app.data.model

import java.io.Serializable

data class ArbitragePool(
    val id: String,
    val title: String,
    val dailyRoi: Double, // e.g. 3.2%
    val lockPeriodDays: Int,
    val minDepositUsdt: Double,
    val totalInvestedUsdt: Double = 0.0,
    val totalEarnedUsdt: Double = 0.0,
    val isSubscribed: Boolean = false,
    val riskLevel: String = "Audited Escrow"
) : Serializable

enum class TransactionType {
    BUY_USDT,
    SELL_USDT,
    DEPOSIT_INR,
    WITHDRAW_INR,
    REFERRAL_BONUS,
    ARBITRAGE_YIELD
}

data class TransactionRecord(
    val id: String,
    val type: TransactionType,
    val amountInr: Double,
    val amountUsdt: Double,
    val reference: String,
    val status: String = "SUCCESS",
    val timestamp: Long = System.currentTimeMillis()
) : Serializable

data class SystemConfig(
    val isServiceOnline: Boolean = true,
    val usdtExchangeRate: Double = 91.50,
    val inrSignupReward: Double = 300.0,
    val adminPasswordHash: String = "8888",
    val telegramSupportUrl: String = "https://t.me/crazypay_official_support"
) : Serializable
