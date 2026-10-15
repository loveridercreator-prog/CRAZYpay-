package com.crazypay.app.ui.auth

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.crazypay.app.R
import com.crazypay.app.data.local.CrazyPayDatabase
import com.crazypay.app.data.local.entities.UserEntity
import com.crazypay.app.ui.MainActivity
import kotlinx.coroutines.launch

class AuthActivity : AppCompatActivity() {

    private lateinit var tabLogin: Button
    private lateinit var tabRegister: Button
    private lateinit var etPhone: EditText
    private lateinit var etPassword: EditText
    private lateinit var etCaptcha: EditText
    private lateinit var tvCaptchaCode: TextView
    private lateinit var etOtp: EditText
    private lateinit var btnSendOtp: Button
    private lateinit var btnAuthSubmit: Button
    private lateinit var btnQuickDemo: Button

    private var isLoginMode = true
    private var generatedCaptcha = "7492"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_auth)

        tabLogin = findViewById(R.id.tabLogin)
        tabRegister = findViewById(R.id.tabRegister)
        etPhone = findViewById(R.id.etPhone)
        etPassword = findViewById(R.id.etPassword)
        etCaptcha = findViewById(R.id.etCaptcha)
        tvCaptchaCode = findViewById(R.id.tvCaptchaCode)
        etOtp = findViewById(R.id.etOtp)
        btnSendOtp = findViewById(R.id.btnSendOtp)
        btnAuthSubmit = findViewById(R.id.btnAuthSubmit)
        btnQuickDemo = findViewById(R.id.btnQuickDemo)

        refreshCaptcha()
        setupTabSwitching()
        setupAuthActions()
    }

    private fun refreshCaptcha() {
        generatedCaptcha = (1000..9999).random().toString()
        tvCaptchaCode.text = generatedCaptcha
    }

    private fun setupTabSwitching() {
        tabLogin.setOnClickListener {
            isLoginMode = true
            tabLogin.setBackgroundResource(R.drawable.bg_button_primary)
            tabLogin.setTextColor(resources.getColor(R.color.text_white, null))
            tabRegister.setBackgroundColor(resources.getColor(R.color.transparent, null))
            tabRegister.setTextColor(resources.getColor(R.color.text_muted, null))
            btnAuthSubmit.text = "Log In"
        }

        tabRegister.setOnClickListener {
            isLoginMode = false
            tabRegister.setBackgroundResource(R.drawable.bg_button_primary)
            tabRegister.setTextColor(resources.getColor(R.color.text_white, null))
            tabLogin.setBackgroundColor(resources.getColor(R.color.transparent, null))
            tabLogin.setTextColor(resources.getColor(R.color.text_muted, null))
            btnAuthSubmit.text = "Create Account"
        }

        tvCaptchaCode.setOnClickListener {
            refreshCaptcha()
        }

        btnSendOtp.setOnClickListener {
            val phone = etPhone.text.toString().trim()
            if (phone.length < 10) {
                Toast.makeText(this, "Please enter valid 10-digit mobile number", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            etOtp.setText("882194")
            Toast.makeText(this, "OTP 882194 sent to $phone", Toast.LENGTH_LONG).show()
        }
    }

    private fun setupAuthActions() {
        btnAuthSubmit.setOnClickListener {
            val phone = etPhone.text.toString().trim()
            val password = etPassword.text.toString().trim()
            val captcha = etCaptcha.text.toString().trim()

            if (phone.isEmpty()) {
                Toast.makeText(this, "Please enter mobile number", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (password.length < 4) {
                Toast.makeText(this, "Password must be at least 4 characters", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (captcha != generatedCaptcha && captcha.isNotEmpty()) {
                Toast.makeText(this, "Invalid Captcha. Please enter $generatedCaptcha", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            lifecycleScope.launch {
                val db = CrazyPayDatabase.getDatabase(this@AuthActivity)
                val existingUser = db.userDao().getCurrentUser()
                if (existingUser == null) {
                    val newUser = UserEntity(
                        mobile = phone,
                        displayName = "User " + phone.takeLast(4),
                        role = "USER",
                        kycLevel = "TIER_1",
                        balanceInr = 10000.00,
                        balanceUsdt = 100.00
                    )
                    db.userDao().insertUser(newUser)
                }
                openMainDashboard()
            }
        }

        btnQuickDemo.setOnClickListener {
            openMainDashboard()
        }
    }

    private fun openMainDashboard() {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        startActivity(intent)
        finish()
    }
}
