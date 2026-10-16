package com.crazypay.app.ui.trade

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.CountDownTimer
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.crazypay.app.CrazyPayApplication
import com.crazypay.app.data.model.OrderStatus
import com.crazypay.app.data.model.P2pOrder
import com.crazypay.app.databinding.ActivityOrderDetailBinding

class OrderDetailActivity : AppCompatActivity() {

    private lateinit var binding: ActivityOrderDetailBinding
    private val repository by lazy { (application as CrazyPayApplication).repository }
    private var orderId: String = ""
    private var countDownTimer: CountDownTimer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityOrderDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        orderId = intent.getStringExtra("EXTRA_ORDER_ID") ?: ""
        if (orderId.isEmpty()) {
            finish()
            return
        }

        setupViews()
        setupListeners()
    }

    private fun setupViews() {
        val order = repository.orders.value.find { it.id == orderId }
        if (order == null) {
            Toast.makeText(this, "Order not found", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        bindOrderData(order)
        startCountdown(order)
    }

    private fun bindOrderData(order: P2pOrder) {
        binding.tvDetailStatus.text = order.status.name
        binding.tvDetailAmountInr.text = String.format("₹ %,.2f", order.amountInr)
        binding.tvDetailAmountUsdt.text = String.format("You will receive: %.2f USDT", order.amountUsdt)
        binding.tvSellerUpi.text = order.sellerUpiId

        if (order.status == OrderStatus.RELEASED) {
            binding.tvDetailStatus.setTextColor(getColor(com.crazypay.app.R.color.success_green))
            binding.tvCountdownTimer.text = "ESCROW RELEASED"
            binding.tvCountdownTimer.setTextColor(getColor(com.crazypay.app.R.color.success_green))
            binding.etUtrInput.setText(order.utrNumber)
            binding.etUtrInput.isEnabled = false
            binding.btnVerifyUtr.isEnabled = false
            binding.btnVerifyUtr.text = "TRANSACTION COMPLETED"
        }
    }

    private fun startCountdown(order: P2pOrder) {
        if (order.status == OrderStatus.RELEASED) return

        val remainingMillis = (order.expiresAt - System.currentTimeMillis()).coerceAtLeast(0L)
        countDownTimer?.cancel()
        countDownTimer = object : CountDownTimer(remainingMillis, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val minutes = (millisUntilFinished / 1000) / 60
                val seconds = (millisUntilFinished / 1000) % 60
                binding.tvCountdownTimer.text = String.format("%02d:%02d", minutes, seconds)
            }

            override fun onFinish() {
                binding.tvCountdownTimer.text = "00:00"
            }
        }.start()
    }

    private fun setupListeners() {
        binding.btnBackOrder.setOnClickListener {
            finish()
        }

        binding.btnCopyUpi.setOnClickListener {
            val upi = binding.tvSellerUpi.text.toString()
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("Seller UPI", upi))
            Toast.makeText(this, "UPI copied to clipboard: $upi", Toast.LENGTH_SHORT).show()
        }

        binding.btnVerifyUtr.setOnClickListener {
            val utr = binding.etUtrInput.text.toString().trim()
            binding.tvUtrError.visibility = View.GONE

            if (utr.length != 12 || !utr.all { it.isDigit() }) {
                binding.tvUtrError.text = "Please enter a valid 12-digit numeric UTR reference number."
                binding.tvUtrError.visibility = View.VISIBLE
                return@setOnClickListener
            }

            binding.btnVerifyUtr.isEnabled = false
            binding.btnVerifyUtr.text = "Verifying with NPCI Gateway..."

            val result = repository.verifyUtr(orderId, utr)
            result.onSuccess { updated ->
                Toast.makeText(this, "✓ UTR Verified! Escrow released successfully.", Toast.LENGTH_LONG).show()
                bindOrderData(updated)
            }.onFailure { err ->
                binding.btnVerifyUtr.isEnabled = true
                binding.btnVerifyUtr.text = "VERIFY UTR & RELEASE ESCROW"
                binding.tvUtrError.text = err.message ?: "Verification failed."
                binding.tvUtrError.visibility = View.VISIBLE
            }
        }

        binding.tvOrderSupportLink.setOnClickListener {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(repository.systemConfig.value.telegramSupportUrl))
            try {
                startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(this, "Support: @crazypay_official_support", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        countDownTimer?.cancel()
    }
}
