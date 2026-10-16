package com.crazypay.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.crazypay.app.data.local.PreferencesManager
import com.crazypay.app.data.repository.CrazyPayRepository

class CrazyPayApplication : Application() {

    lateinit var prefsManager: PreferencesManager
        private set

    lateinit var repository: CrazyPayRepository
        private set

    companion object {
        lateinit var instance: CrazyPayApplication
            private set

        const val CHANNEL_TRANSACTIONS = "crazypay_transactions_channel"
        const val CHANNEL_SECURITY = "crazypay_security_alerts_channel"
    }

    override fun onCreate() {
        super.onCreate()
        instance = this

        prefsManager = PreferencesManager(this)
        repository = CrazyPayRepository(prefsManager)

        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(NotificationManager::class.java)

            val txChannel = NotificationChannel(
                CHANNEL_TRANSACTIONS,
                "P2P Transaction Updates",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications regarding escrow release and UTR payment verification"
                enableVibration(true)
            }

            val securityChannel = NotificationChannel(
                CHANNEL_SECURITY,
                "Security & Ledger Protection",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Ledger sync notices and cross-device security authorization"
            }

            notificationManager.createNotificationChannel(txChannel)
            notificationManager.createNotificationChannel(securityChannel)
        }
    }
}
