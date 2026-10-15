package com.crazypay.app.data.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.crazypay.app.data.repository.CrazyPayRepository
import com.crazypay.app.data.worker.UtrSyncWorker
import com.crazypay.app.domain.parser.BankSmsParserEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

/**
 * BroadcastReceiver for intercepting incoming transactional bank SMS notifications.
 * Automatically extracts 12-digit UTR, matches against pending P2P trades, and triggers background sync.
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

        val sender = messages[0].displayOriginatingAddress ?: return
        val fullBody = StringBuilder()
        var receivedTimestamp = messages[0].timestampMillis

        for (sms in messages) {
            sms.displayMessageBody?.let { fullBody.append(it) }
        }

        if (receivedTimestamp <= 0L) {
            receivedTimestamp = System.currentTimeMillis()
        }

        val parseResult = parserEngine.parse(
            rawSender = sender,
            rawBody = fullBody.toString(),
            receivedTimestamp = receivedTimestamp
        )

        parseResult.onSuccess { notification ->
            // 1. Instant local Room DB reconciliation
            val pendingResult = goAsync()
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val repository = CrazyPayRepository(context)
                    repository.handleInwardSms(
                        utr = notification.utr,
                        amount = notification.amount,
                        senderHeader = notification.senderHeader,
                        timestamp = notification.timestamp
                    )
                } finally {
                    pendingResult.finish()
                }
            }

            // 2. Guaranteed background sync via WorkManager
            enqueueUtrSyncWork(
                context,
                notification.utr,
                notification.amount,
                notification.senderHeader,
                notification.timestamp
            )
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
