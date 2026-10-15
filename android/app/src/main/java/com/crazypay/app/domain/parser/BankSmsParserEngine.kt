package com.crazypay.app.domain.parser

import java.util.regex.Pattern

/**
 * Domain entity representing an extracted and validated inward payment notification.
 */
data class ParsedTransactionNotification(
    val utr: String,
    val amount: Double,
    val senderHeader: String,
    val timestamp: Long,
    val isCredit: Boolean
)

/**
 * Sealed class representing domain parsing failures.
 */
sealed class SmsParsingException(message: String) : Exception(message) {
    object InvalidSenderException : SmsParsingException("Sender does not match authorized transactional bank headers ending in -T.")
    object NotCreditTransactionException : SmsParsingException("SMS does not represent an inward credit transaction.")
    object UtrNotFoundException : SmsParsingException("Failed to locate a valid 12-digit UTR/RRN in the message.")
    object AmountNotFoundException : SmsParsingException("Failed to locate a valid positive currency amount in the message.")
}

/**
 * Pure Kotlin parser for extracting structured payment details from bank SMS notifications.
 * Contains zero Android SDK dependencies to guarantee fast, hermetic JVM unit testing.
 */
class BankSmsParserEngine {

    companion object {
        // Indian DLT Transactional Header Regex: 2-letter operator prefix, hyphen, bank code, hyphen, T suffix
        // Examples: AX-HDFCBK-T, BZ-SBIBNK-T, VK-ICICIB-T, VM-KOTAKB-T, AD-AXISBK-T
        private val BANK_HEADER_PATTERN = Pattern.compile(
            "^[A-Z]{2}-([A-Za-z0-9]{5,8})-T$",
            Pattern.CASE_INSENSITIVE
        )

        // Keywords that confirm money was credited (inward transaction)
        private val CREDIT_KEYWORDS = listOf(
            "credited", 
            "received", 
            "deposited", 
            "credited to", 
            "received from"
        )

        // Keywords indicating a debit transaction (must be strictly rejected)
        private val DEBIT_KEYWORDS = listOf(
            "debited", 
            "spent", 
            "paid to", 
            "sent to", 
            "transferred to"
        )

        // Regex for 12-digit UTR/RRN associated with UPI
        private val UTR_PATTERN = Pattern.compile(
            "(?:UTR|RRN|UPI\\s*Ref(?:\\s*No)?|Ref(?:\\s*No)?)\\s*[:\\-]?\\s*(\\d{12})",
            Pattern.CASE_INSENSITIVE
        )

        // Standalone 12-digit fallback
        private val UTR_FALLBACK_PATTERN = Pattern.compile(
            "\\b(\\d{12})\\b"
        )

        // Regex for INR Amounts (e.g., "Rs. 1,499.00", "INR 500", "Rs 250.50")
        private val AMOUNT_PATTERN = Pattern.compile(
            "(?:Rs\\.?|INR)\\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)",
            Pattern.CASE_INSENSITIVE
        )
    }

    /**
     * Parses an incoming raw SMS and returns a Result containing the parsed transaction or an error.
     */
    fun parse(rawSender: String, rawBody: String, receivedTimestamp: Long): Result<ParsedTransactionNotification> {
        val cleanSender = rawSender.trim()
        val cleanBody = rawBody.trim()

        // 1. Verify Sender Header matches authorized bank transactional pattern ending with -T
        if (!BANK_HEADER_PATTERN.matcher(cleanSender).matches()) {
            return Result.failure(SmsParsingException.InvalidSenderException)
        }

        val lowerBody = cleanBody.lowercase()

        // 2. Reject debit or non-credit messages immediately
        val hasDebitKeyword = DEBIT_KEYWORDS.any { lowerBody.contains(it) }
        val hasCreditKeyword = CREDIT_KEYWORDS.any { lowerBody.contains(it) }

        if (hasDebitKeyword && !hasCreditKeyword) {
            return Result.failure(SmsParsingException.NotCreditTransactionException)
        }

        if (!hasCreditKeyword) {
            return Result.failure(SmsParsingException.NotCreditTransactionException)
        }

        // 3. Extract 12-digit UTR
        val utr = extractUtr(cleanBody) 
            ?: return Result.failure(SmsParsingException.UtrNotFoundException)

        // Guard against repeating digit attacks (e.g. 000000000000 or 111111111111)
        if (utr.matches(Regex("^(\\d)\\1{11}$")) || utr == "123456789012" || utr == "012345678901") {
            return Result.failure(SmsParsingException.UtrNotFoundException)
        }

        // 4. Extract Amount
        val amount = extractAmount(cleanBody) 
            ?: return Result.failure(SmsParsingException.AmountNotFoundException)

        if (amount <= 0.0) {
            return Result.failure(SmsParsingException.AmountNotFoundException)
        }

        return Result.success(
            ParsedTransactionNotification(
                utr = utr,
                amount = amount,
                senderHeader = cleanSender,
                timestamp = receivedTimestamp,
                isCredit = true
            )
        )
    }

    private fun extractUtr(body: String): String? {
        val matcher = UTR_PATTERN.matcher(body)
        if (matcher.find()) {
            return matcher.group(1)
        }

        // Secondary search if keyword was separated
        val fallbackMatcher = UTR_FALLBACK_PATTERN.matcher(body)
        while (fallbackMatcher.find()) {
            val candidate = fallbackMatcher.group(1)
            if (candidate != null && candidate.length == 12) {
                return candidate
            }
        }
        return null
    }

    private fun extractAmount(body: String): Double? {
        val matcher = AMOUNT_PATTERN.matcher(body)
        if (matcher.find()) {
            val amountStr = matcher.group(1)?.replace(",", "")
            return amountStr?.toDoubleOrNull()
        }
        return null
    }
}
