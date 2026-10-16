package com.crazypay.app.ui.trade

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import com.crazypay.app.CrazyPayApplication
import com.crazypay.app.databinding.DialogSellOrderBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class SellBottomSheetDialog : BottomSheetDialogFragment() {

    private var _binding: DialogSellOrderBinding? = null
    private val binding get() = _binding!!
    private val repository by lazy { (requireActivity().application as CrazyPayApplication).repository }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogSellOrderBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val user = repository.currentUser.value
        val rate = repository.systemConfig.value.usdtExchangeRate

        binding.tvSellBalanceInfo.text = String.format("Available: %.2f USDT | Rate: 1 USDT = ₹%.2f", user?.usdtBalance ?: 0.0, rate)

        // Pre-fill primary UPI handle if available
        val primaryUpi = repository.upiHandles.value.find { it.isPrimary }?.upiId ?: ""
        if (primaryUpi.isNotEmpty()) {
            binding.etSellReceivingUpi.setText(primaryUpi)
        }

        binding.etSellUsdt.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val usdt = s.toString().toDoubleOrNull() ?: 0.0
                val inr = usdt * rate
                binding.tvSellCalculatedInr.text = String.format("₹ %,.2f", inr)
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        binding.btnConfirmSell.setOnClickListener {
            val amount = binding.etSellUsdt.text.toString().toDoubleOrNull()
            val upi = binding.etSellReceivingUpi.text.toString().trim()

            if (amount == null || amount <= 0) {
                Toast.makeText(requireContext(), "Please enter a valid USDT amount to sell.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (upi.isEmpty() || !upi.contains("@")) {
                Toast.makeText(requireContext(), "Please enter a valid receiving UPI ID.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val result = repository.sellUsdt(amount, upi)
            result.onSuccess {
                Toast.makeText(requireContext(), "✓ Sell order executed! ₹ has been transferred to $upi", Toast.LENGTH_LONG).show()
                dismiss()
            }.onFailure { err ->
                Toast.makeText(requireContext(), err.message ?: "Failed to execute sell order.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "SellBottomSheetDialog"
    }
}
