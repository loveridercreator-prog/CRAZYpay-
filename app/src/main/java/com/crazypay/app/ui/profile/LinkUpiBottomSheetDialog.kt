package com.crazypay.app.ui.profile

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import com.crazypay.app.CrazyPayApplication
import com.crazypay.app.databinding.DialogLinkUpiBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class LinkUpiBottomSheetDialog : BottomSheetDialogFragment() {

    private var _binding: DialogLinkUpiBinding? = null
    private val binding get() = _binding!!
    private val repository by lazy { (requireActivity().application as CrazyPayApplication).repository }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogLinkUpiBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.btnSaveUpi.setOnClickListener {
            val upiId = binding.etNewUpiId.text.toString().trim()
            val holder = binding.etNewUpiHolder.text.toString().trim()

            if (upiId.isEmpty() || !upiId.contains("@")) {
                Toast.makeText(requireContext(), "Please enter a valid UPI address (e.g. name@okaxis)", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (holder.isEmpty()) {
                Toast.makeText(requireContext(), "Please enter account beneficiary name.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val result = repository.bindUpi(upiId, holder, "UPI Direct")
            result.onSuccess {
                Toast.makeText(requireContext(), "✓ Successfully bound $upiId as your primary account.", Toast.LENGTH_LONG).show()
                dismiss()
            }.onFailure { err ->
                Toast.makeText(requireContext(), err.message ?: "Failed to bind UPI.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "LinkUpiBottomSheetDialog"
    }
}
