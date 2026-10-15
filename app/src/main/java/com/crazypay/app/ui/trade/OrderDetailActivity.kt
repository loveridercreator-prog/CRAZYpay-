package com.crazypay.app.ui.trade

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.os.CountDownTimer
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.crazypay.app.R
import com.crazypay.app.data.local.entities.TradeEntity
import com.crazypay.app.data.repository.CrazyPayRepository
import kotlinx.coroutines.launch
import java.text.DecimalFormat

class OrderDetailActivity : AppCompatActivity() {

    private lateinit var repository: CrazyPayRepository
    private var currentOrderId: String? = null
    private var currentTrade: TradeEntity? = null
    private var timer: CountDownTimer? = null

    private lateinit var btnBack: Button
    private lateinit var tvOrderIdHeader: TextView
    private lateinit var tvCountdown: TextView
    private lateinit var tvOrderFiatAmount: TextView
    private lateinit var tvOrderCryptoAmount: TextView
    private lateinit var tvSellerName: TextView
    private lateinit var tvSellerUpi: TextView
    private lateinit var btnCopyUpi: Button
    private lateinit var etManualUtr: EditText
    private lateinit var btnSubmitUtr: Button
    private lateinit var btnSimulateSms: Button

    private val inrFormat = DecimalFormat("#,##0.00")
    private val cryptoFormat = DecimalFormat("0.0000")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_order_detail)

        repository = CrazyPayRepository(this)
        currentOrderId = intent.getStringExtra("EXTRA_ORDER_ID")

        btnBack = findViewById(R.id.btnBack)
        tvOrderIdHeader = findViewById(R.id.tvOrderIdHeader)
        tvCountdown = findViewById(R.id.tvCountdown)
        tvOrderFiatAmount = findViewById(R.id.tvOrderFiatAmount)
        tvOrderCryptoAmount = findViewById(R.id.tvOrderCryptoAmount)
        tvSellerName = findViewById(R.id.tvSellerName)
        tvSellerUpi = findViewById(R.id.tvSellerUpi)
        btnCopyUpi = findViewById(R.id.btnCopyUpi)
        etManualUtr = findViewById(R.id.etManualUtr)
        btnSubmitUtr = findViewById(R.id.btnSubmitUtr)
        btnSimulateSms = findViewById(R.id.btnSimulateSms)

        btnBack.setOnClickListener { finish() }

        loadTradeDetails()
        setupActions()
    }

    private fun loadTradeDetails() {
        val orderId = currentOrderId ?: return
        lifecycleScope.launch {
            currentTrade = repository.getTradeByOrderId(orderId)
            currentTrade?.let { trade ->
                tvOrderIdHeader.text = "Order ID: ${trade.orderId}"
                tvOrderFiatAmount.text = "₹" + inrFormat.format(trade.fiatAmount)
                tvOrderCryptoAmount.text = "Receiving: ${cryptoFormat.format(trade.assetAmount)} ${trade.asset} (@ ₹${trade.exchangeRate}/USDT)"
                tvSellerName.text = "Counterparty: ${trade.sellerName}"
                tvSellerUpi.text = trade.boundPaymentIdentifier

                if (trade.status == "COMPLETED") {
                    btnSubmitUtr.text = "Order Completed & Settled"
                    btnSubmitUtr.isEnabled = false
                    tvCountdown.text = "SETTLED"
                    tvCountdown.setBackgroundResource(R.drawable.bg_badge_active)
                    tvCountdown.setTextColor(resources.getColor(R.color.success_green, null))
                } else {
                    startCountdownTimer(trade.expiresAt)
                }
            }
        }
    }

    private fun startCountdownTimer(expiresAt: Long) {
        val millisLeft = (expiresAt - System.currentTimeMillis()).coerceAtLeast(0L)
        timer?.cancel()
        timer = object : CountDownTimer(millisLeft, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val minutes = (millisUntilFinished / 1000) / 60
                val seconds = (millisUntilFinished / 1000) % 60
                tvCountdown.text = String.format("%02d:%02d", minutes, seconds)
            }

            override fun onFinish() {
                tvCountdown.text = "EXPIRED"
            }
        }.start()
    }

    private fun setupActions() {
        btnCopyUpi.setOnClickListener {
            val upi = tvSellerUpi.text.toString()
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("UPI ID", upi))
            Toast.makeText(this, "UPI Copied to Clipboard!", Toast.LENGTH_SHORT).show()
        }

        btnSubmitUtr.setOnClickListener {
            val utr = etManualUtr.text.toString().trim()
            if (utr.length != 12 || !utr.all { it.isDigit() }) {
                Toast.makeText(this, "Please enter a valid 12-digit numeric UTR/RRN", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val orderId = currentOrderId ?: return@setOnClickListener
            lifecycleScope.launch {
                val success = repository.submitUtr(orderId, utr)
                if (success) {
                    showSuccessDialog(utr)
                }
            }
        }

        // Simulates receiving an inward bank SMS for this exact order
        btnSimulateSms.setOnClickListener {
            val trade = currentTrade ?: return@setOnClickListener
            val demoUtr = (100000000000L..999999999999L).random().toString()
            lifecycleScope.launch {
                val matched = repository.handleInwardSms(
                    utr = demoUtr,
                    amount = trade.fiatAmount,
                    senderHeader = "AX-HDFCBK-T",
                    timestamp = System.currentTimeMillis()
                )
                if (matched != null) {
                    showSuccessDialog(demoUtr)
                }
            }
        }
    }

    private fun showSuccessDialog(utr: String) {
        AlertDialog.Builder(this)
            .setTitle("Payment Verified & Completed!")
            .setMessage("UTR $utr was successfully verified by CrazyPay Engine. USDT has been released to your wallet.")
            .setPositiveButton("OK") { _, _ ->
                loadTradeDetails()
            }
            .setCancelable(false)
            .show()
    }

    override fun onDestroy() {
        super.onDestroy()
        timer?.cancel()
    }
}
