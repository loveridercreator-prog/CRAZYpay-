package com.crazypay.app.ui.trade

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import com.crazypay.app.CrazyPayApplication
import com.crazypay.app.databinding.DialogWithdrawBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class WithdrawBottomSheetDialog : BottomSheetDialogFragment() {

    private var _binding: DialogWithdrawBinding? = null
    private val binding get() = _binding!!
    private val repository by lazy { (requireActivity().application as CrazyPayApplication).repository }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogWithdrawBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val user = repository.currentUser.value
        binding.tvWithdrawBalanceInfo.text = String.format("Available INR Balance: ₹ %,.2f", user?.balance ?: 0.0)

        val primaryUpi = repository.upiHandles.value.find { it.isPrimary }?.upiId ?: ""
        if (primaryUpi.isNotEmpty()) {
            binding.etWithdrawUpi.setText(primaryUpi)
        }

        binding.btnConfirmWithdraw.setOnClickListener {
            val amount = binding.etWithdrawInr.text.toString().toDoubleOrNull()
            val upi = binding.etWithdrawUpi.text.toString().trim()

            if (amount == null || amount < 100) {
                Toast.makeText(requireContext(), "Minimum withdrawal is ₹ 100.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (upi.isEmpty() || !upi.contains("@")) {
                Toast.makeText(requireContext(), "Please enter a valid destination UPI ID.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val result = repository.withdrawInr(amount, upi)
            result.onSuccess {
                Toast.makeText(requireContext(), "✓ ₹ %,.2f withdrawal dispatched to %s via IMPS.".format(amount, upi), Toast.LENGTH_LONG).show()
                dismiss()
            }.onFailure { err ->
                Toast.makeText(requireContext(), err.message ?: "Withdrawal failed.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "WithdrawBottomSheetDialog"
    }
}
