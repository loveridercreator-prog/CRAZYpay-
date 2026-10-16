package com.crazypay.app.ui.trade

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import com.crazypay.app.CrazyPayApplication
import com.crazypay.app.data.model.P2pSeller
import com.crazypay.app.databinding.DialogBuyOrderBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class BuyBottomSheetDialog(
    private val seller: P2pSeller
) : BottomSheetDialogFragment() {

    private var _binding: DialogBuyOrderBinding? = null
    private val binding get() = _binding!!
    private val repository by lazy { (requireActivity().application as CrazyPayApplication).repository }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogBuyOrderBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.tvDialogSellerInfo.text = String.format("Seller: %s | 1 USDT = ₹%.2f", seller.name, seller.priceRate)
        binding.etBuyInr.hint = String.format("Limit: ₹%,.0f - ₹%,.0f", seller.minLimit, seller.maxLimit)

        binding.etBuyInr.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val inr = s.toString().toDoubleOrNull() ?: 0.0
                val usdt = inr / seller.priceRate
                binding.tvCalculatedUsdt.text = String.format("%.2f USDT", usdt)
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        binding.btnConfirmBuy.setOnClickListener {
            val amount = binding.etBuyInr.text.toString().toDoubleOrNull()
            if (amount == null || amount < seller.minLimit || amount > seller.maxLimit) {
                Toast.makeText(requireContext(), String.format("Amount must be between ₹%,.0f and ₹%,.0f", seller.minLimit, seller.maxLimit), Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val gateway = when (binding.chipGroupGateways.checkedChipId) {
                binding.chipPhonepe.id -> "PhonePe"
                binding.chipPaytm.id -> "Paytm"
                else -> "Google Pay"
            }

            val result = repository.createBuyOrder(amount, seller, gateway)
            result.onSuccess { order ->
                dismiss()
                val intent = Intent(requireContext(), OrderDetailActivity::class.java).apply {
                    putExtra("EXTRA_ORDER_ID", order.id)
                }
                startActivity(intent)
            }.onFailure { err ->
                Toast.makeText(requireContext(), err.message ?: "Failed to place order.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "BuyBottomSheetDialog"
    }
}
