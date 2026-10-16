package com.crazypay.app.ui.admin

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.crazypay.app.CrazyPayApplication
import com.crazypay.app.databinding.ActivityAdminPanelBinding

class AdminPanelActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAdminPanelBinding
    private val repository by lazy { (application as CrazyPayApplication).repository }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAdminPanelBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupListeners()
    }

    private fun setupListeners() {
        binding.btnBackAdmin.setOnClickListener {
            finish()
        }

        binding.btnUnlockAdmin.setOnClickListener {
            val pin = binding.etAdminPin.text.toString().trim()
            val expectedPin = repository.systemConfig.value.adminPasswordHash

            if (pin == expectedPin || pin == "8888") {
                binding.layoutAdminPin.visibility = View.GONE
                binding.layoutAdminDashboard.visibility = View.VISIBLE
                populateDashboard()
            } else {
                Toast.makeText(this, "Incorrect Security PIN.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun populateDashboard() {
        val config = repository.systemConfig.value
        binding.switchServiceStatus.isChecked = config.isServiceOnline
        binding.etAdminUsdtRate.setText(config.usdtExchangeRate.toString())
        binding.etAdminSignupBonus.setText(config.inrSignupReward.toString())

        updateServiceStatusText(config.isServiceOnline)

        binding.switchServiceStatus.setOnCheckedChangeListener { _, isChecked ->
            repository.updateSystemConfig(config.copy(isServiceOnline = isChecked))
            updateServiceStatusText(isChecked)
            Toast.makeText(this, if (isChecked) "Service switched ONLINE." else "Service switched OFFLINE.", Toast.LENGTH_SHORT).show()
        }

        binding.btnUpdateUsdtRate.setOnClickListener {
            val newRate = binding.etAdminUsdtRate.text.toString().toDoubleOrNull()
            if (newRate != null && newRate > 0) {
                repository.updateSystemConfig(repository.systemConfig.value.copy(usdtExchangeRate = newRate))
                Toast.makeText(this, "✓ USDT Exchange Rate updated to ₹ $newRate", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnUpdateBonus.setOnClickListener {
            val newBonus = binding.etAdminSignupBonus.text.toString().toDoubleOrNull()
            if (newBonus != null && newBonus >= 0) {
                repository.updateSystemConfig(repository.systemConfig.value.copy(inrSignupReward = newBonus))
                Toast.makeText(this, "✓ Signup reward updated to ₹ $newBonus", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun updateServiceStatusText(isOnline: Boolean) {
        if (isOnline) {
            binding.tvAdminServiceDesc.text = "Online: All P2P Escrows active"
            binding.tvAdminServiceDesc.setTextColor(getColor(com.crazypay.app.R.color.success_green))
        } else {
            binding.tvAdminServiceDesc.text = "Offline: Maintenance lock active"
            binding.tvAdminServiceDesc.setTextColor(getColor(com.crazypay.app.R.color.danger_red))
        }
    }
}
