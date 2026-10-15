package com.crazypay.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.crazypay.app.data.local.CrazyPayDatabase

class CrazyPayApplication : Application() {

    companion object {
        const val CHANNEL_ID_TRANSACTIONS = "channel_crazypay_transactions"
        const val CHANNEL_ID_SECURITY = "channel_crazypay_security"
    }

    override fun onCreate() {
        super.onCreate()
        // Initialize Room Database pre-population
        CrazyPayDatabase.getDatabase(this)
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val txChannel = NotificationChannel(
                CHANNEL_ID_TRANSACTIONS,
                "Payment & UTR Settlements",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Real-time P2P trade matching and UTR confirmation alerts"
                enableVibration(true)
            }

            val secChannel = NotificationChannel(
                CHANNEL_ID_SECURITY,
                "Security & Account Alerts",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Account login, OTP, and KYC tier updates"
            }

            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(txChannel)
            manager.createNotificationChannel(secChannel)
        }
    }
}
