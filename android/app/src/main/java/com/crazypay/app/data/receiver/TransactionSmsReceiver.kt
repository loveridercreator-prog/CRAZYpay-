package com.crazypay.app.data.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.BackoffPolicy
import com.crazypay.app.data.worker.UtrSyncWorker
import com.crazypay.app.domain.parser.BankSmsParserEngine
import java.util.concurrent.TimeUnit

/**
 * BroadcastReceiver for intercepting incoming transactional bank SMS notifications.
 *
 * Security & Reliability Safeguards:
 * 1. Must be declared in AndroidManifest.xml with `android:permission="android.permission.BROADCAST_SMS"`
 *    to prevent spoofed broadcasts from malicious third-party apps or ADB.
 * 2. Does NOT execute network operations on the main thread.
 * 3. Immediately enqueues work via Android Jetpack WorkManager with network constraints.
 * 4. Strictly suppresses logging of raw SMS bodies to protect user privacy (Zero PII logging).
 */
class TransactionSmsReceiver : BroadcastReceiver() {

    private val parserEngine = BankSmsParserEngine()

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            return
        }

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) {
            return
        }

        // Aggregate multipart SMS if necessary
        val sender = messages[0].displayOriginatingAddress ?: return
        val fullBody = StringBuilder()
        var receivedTimestamp = messages[0].timestampMillis

        for (sms in messages) {
            sms.displayMessageBody?.let { fullBody.append(it) }
        }

        if (receivedTimestamp <= 0L) {
            receivedTimestamp = System.currentTimeMillis()
        }

        // Attempt domain-level parse
        val parseResult = parserEngine.parse(
            rawSender = sender,
            rawBody = fullBody.toString(),
            receivedTimestamp = receivedTimestamp
        )

        parseResult.onSuccess { notification ->
            // Schedule guaranteed background upload via WorkManager
            enqueueUtrSyncWork(context, notification.utr, notification.amount, notification.senderHeader, notification.timestamp)
        }
    }

    private fun enqueueUtrSyncWork(
        context: Context,
        utr: String,
        amount: Double,
        senderHeader: String,
        timestamp: Long
    ) {
        val inputData = Data.Builder()
            .putString(UtrSyncWorker.KEY_UTR, utr)
            .putDouble(UtrSyncWorker.KEY_AMOUNT, amount)
            .putString(UtrSyncWorker.KEY_SENDER_HEADER, senderHeader)
            .putLong(UtrSyncWorker.KEY_TIMESTAMP, timestamp)
            .build()

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncWorkRequest = OneTimeWorkRequestBuilder<UtrSyncWorker>()
            .setInputData(inputData)
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                10,
                TimeUnit.SECONDS
            )
            .addTag("utr_sync_$utr")
            .build()

        WorkManager.getInstance(context).enqueue(syncWorkRequest)
    }
}
