package com.crazypay.app.data.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.CancellationException
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/**
 * Production WorkManager CoroutineWorker for reliable UTR reporting.
 *
 * Highlights:
 * 1. Executes in background dispatcher without blocking UI.
 * 2. Generates a persistent Idempotency-Key per work attempt.
 * 3. Correctly rethrows `CancellationException` to prevent swallowing coroutine lifecycle cancellation.
 * 4. Retries exponentially on transient network errors (`Result.retry()`).
 * 5. Fails permanently on terminal 4xx validation or client error (`Result.failure()`).
 */
class UtrSyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val KEY_UTR = "key_utr"
        const val KEY_AMOUNT = "key_amount"
        const val KEY_SENDER_HEADER = "key_sender_header"
        const val KEY_TIMESTAMP = "key_timestamp"
        const val KEY_ORDER_ID = "key_order_id"

        private const val DEFAULT_BACKEND_URL = "https://ais-dev-cgz5eojyrehtkvsfbfvzzf-383014714207.asia-southeast1.run.app/api/v1/payments"
    }

    override suspend fun doWork(): Result {
        val utr = inputData.getString(KEY_UTR) ?: return Result.failure()
        val amount = inputData.getDouble(KEY_AMOUNT, -1.0)
        val senderHeader = inputData.getString(KEY_SENDER_HEADER) ?: return Result.failure()
        val messageTimestamp = inputData.getLong(KEY_TIMESTAMP, System.currentTimeMillis())
        val orderId = inputData.getString(KEY_ORDER_ID) ?: UUID.randomUUID().toString()

        if (amount <= 0.0) {
            return Result.failure()
        }

        // Persistent idempotency key derived from work ID
        val idempotencyKey = id.toString()

        return try {
            val responseCode = dispatchUtrReport(
                orderId = orderId,
                utr = utr,
                amount = amount,
                senderHeader = senderHeader,
                messageTimestamp = messageTimestamp,
                idempotencyKey = idempotencyKey
            )

            when (responseCode) {
                in 200..299 -> {
                    // Successfully settled or acknowledged
                    Result.success()
                }
                409 -> {
                    // Duplicate UTR: Terminal failure, do not retry
                    Result.failure()
                }
                in 400..499 -> {
                    // Client validation or bad request: Terminal failure
                    Result.failure()
                }
                else -> {
                    // 5xx Server error or transient issue: Retry with exponential backoff
                    Result.retry()
                }
            }
        } catch (e: CancellationException) {
            // CRITICAL ARCHITECTURAL SAFEGUARD:
            // Must re-throw CancellationException so the coroutine framework properly cancels the job
            throw e
        } catch (e: Exception) {
            // Network I/O or connection timeout: trigger WorkManager retry
            Result.retry()
        }
    }

    private fun dispatchUtrReport(
        orderId: String,
        utr: String,
        amount: Double,
        senderHeader: String,
        messageTimestamp: Long,
        idempotencyKey: String
    ): Int {
        val endpointUrl = "$DEFAULT_BACKEND_URL/$orderId/report-utr"
        val url = URL(endpointUrl)
        val connection = url.openConnection() as HttpURLConnection

        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.doOutput = true
            connection.doInput = true

            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Idempotency-Key", idempotencyKey)
            connection.setRequestProperty("X-Client-Timestamp", System.currentTimeMillis().toString())

            val payloadJson = JSONObject().apply {
                put("orderId", orderId)
                put("utr", utr)
                put("amount", amount)
                put("currency", "INR")
                put("senderHeader", senderHeader)
                put("messageTimestamp", messageTimestamp)
                put("clientMetadata", JSONObject().apply {
                    put("appVersion", "2.1.0")
                    put("networkType", "MOBILE_CONNECTED")
                })
            }

            OutputStreamWriter(connection.outputStream, "UTF-8").use { writer ->
                writer.write(payloadJson.toString())
                writer.flush()
            }

            val responseCode = connection.responseCode

            // Consume stream to allow HTTP connection reuse
            val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
            if (stream != null) {
                BufferedReader(InputStreamReader(stream)).use { reader ->
                    reader.readText()
                }
            }

            return responseCode
        } finally {
            connection.disconnect()
        }
    }
}
