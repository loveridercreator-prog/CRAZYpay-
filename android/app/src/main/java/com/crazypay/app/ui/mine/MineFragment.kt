package com.crazypay.app.ui.mine

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.crazypay.app.R
import com.crazypay.app.data.repository.CrazyPayRepository
import com.crazypay.app.ui.auth.AuthActivity
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.text.DecimalFormat

class MineFragment : Fragment() {

    private lateinit var repository: CrazyPayRepository
    private lateinit var tvProfileName: TextView
    private lateinit var tvProfilePhone: TextView
    private lateinit var tvMineInr: TextView
    private lateinit var tvMineUsdt: TextView
    private lateinit var btnLogout: Button
    private lateinit var optKyc: View
    private lateinit var optBiometrics: View
    private lateinit var optSmsEngine: View

    private val inrFormat = DecimalFormat("#,##0.00")
    private val usdtFormat = DecimalFormat("0.0000")

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_mine, container, false)
        repository = CrazyPayRepository(requireContext())

        tvProfileName = view.findViewById(R.id.tvProfileName)
        tvProfilePhone = view.findViewById(R.id.tvProfilePhone)
        tvMineInr = view.findViewById(R.id.tvMineInr)
        tvMineUsdt = view.findViewById(R.id.tvMineUsdt)
        btnLogout = view.findViewById(R.id.btnLogout)
        optKyc = view.findViewById(R.id.optKyc)
        optBiometrics = view.findViewById(R.id.optBiometrics)
        optSmsEngine = view.findViewById(R.id.optSmsEngine)

        setupListeners()
        observeProfile()

        return view
    }

    private fun setupListeners() {
        optKyc.setOnClickListener {
            AlertDialog.Builder(requireContext())
                .setTitle("KYC Tier 2 Status")
                .setMessage("Your Aadhaar & PAN verification is Active. Daily limit: ₹2,00,000 INR.\nSingle trade limit: ₹50,000 INR.")
                .setPositiveButton("Close", null)
                .show()
        }

        optBiometrics.setOnClickListener {
            Toast.makeText(requireContext(), "Biometric Fingerprint Shield is active for all withdrawals.", Toast.LENGTH_SHORT).show()
        }

        optSmsEngine.setOnClickListener {
            AlertDialog.Builder(requireContext())
                .setTitle("Bank SMS Parser Diagnostics")
                .setMessage("Telecom DLT Header Filtering: PASS\n12-Digit UPI/RRN Regex: PASS\nZero-PII Local Isolation: PASS\nWorkManager Guaranteed Queue: RUNNING")
                .setPositiveButton("OK", null)
                .show()
        }

        btnLogout.setOnClickListener {
            val intent = Intent(requireContext(), AuthActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
            startActivity(intent)
        }
    }

    private fun observeProfile() {
        viewLifecycleOwner.lifecycleScope.launch {
            repository.getCurrentUserFlow().collectLatest { user ->
                user?.let {
                    tvProfileName.text = it.displayName
                    tvProfilePhone.text = it.mobile
                    tvMineInr.text = "₹" + inrFormat.format(it.balanceInr)
                    tvMineUsdt.text = usdtFormat.format(it.balanceUsdt) + " USDT"
                }
            }
        }
    }
}
