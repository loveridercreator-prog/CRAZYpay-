package com.crazypay.app.ui.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.crazypay.app.CrazyPayApplication
import com.crazypay.app.databinding.ActivityAuthBinding
import com.crazypay.app.ui.MainActivity
import com.google.android.material.tabs.TabLayout

class AuthActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAuthBinding
    private val repository by lazy { (application as CrazyPayApplication).repository }
    private val prefs by lazy { (application as CrazyPayApplication).prefsManager }

    private var isRegisterMode = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Auto-navigate to dashboard if user has active session
        if (repository.currentUser.value != null && repository.currentUser.value!!.isLoggedIn) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }

        binding = ActivityAuthBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupTabs()
        setupListeners()
        prefillRememberedPhone()
    }

    private fun prefillRememberedPhone() {
        val remembered = prefs.getRememberedPhone()
        if (remembered.isNotEmpty()) {
            binding.etPhone.setText(remembered)
        }
    }

    private fun setupTabs() {
        binding.tabLayoutAuth.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                isRegisterMode = tab?.position == 1
                updateUiForMode()
            }

            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
    }

    private fun updateUiForMode() {
        binding.tvAuthError.visibility = View.GONE
        if (isRegisterMode) {
            binding.layoutInviteCode.visibility = View.VISIBLE
            binding.btnSubmitAuth.text = "Create Account"
        } else {
            binding.layoutInviteCode.visibility = View.GONE
            binding.btnSubmitAuth.text = "Log In to Account"
        }
    }

    private fun setupListeners() {
        binding.btnSubmitAuth.setOnClickListener {
            val phone = binding.etPhone.text.toString().trim()
            val pass = binding.etPassword.text.toString().trim()
            val inviteCode = binding.etInviteCode.text.toString().trim()

            binding.tvAuthError.visibility = View.GONE

            if (phone.isEmpty() || phone.length != 10) {
                showError("Please enter a valid 10-digit Indian mobile number.")
                return@setOnClickListener
            }

            if (pass.isEmpty() || pass.length < 4) {
                showError("Password must be at least 4 characters.")
                return@setOnClickListener
            }

            val result = if (isRegisterMode) {
                repository.register(phone, pass, inviteCode)
            } else {
                repository.login(phone, pass)
            }

            result.onSuccess {
                startActivity(Intent(this, MainActivity::class.java))
                finish()
            }.onFailure { err ->
                showError(err.message ?: "Authentication failed. Please verify credentials.")
            }
        }
    }

    private fun showError(msg: String) {
        binding.tvAuthError.text = msg
        binding.tvAuthError.visibility = View.VISIBLE
    }
}
