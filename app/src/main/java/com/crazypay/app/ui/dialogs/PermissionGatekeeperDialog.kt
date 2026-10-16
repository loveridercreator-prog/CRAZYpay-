package com.crazypay.app.ui.dialogs

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import com.crazypay.app.CrazyPayApplication
import com.crazypay.app.databinding.DialogPermissionGatekeeperBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class PermissionGatekeeperDialog(
    private val onAuthorized: () -> Unit
) : BottomSheetDialogFragment() {

    private var _binding: DialogPermissionGatekeeperBinding? = null
    private val binding get() = _binding!!
    private val repository by lazy { (requireActivity().application as CrazyPayApplication).repository }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogPermissionGatekeeperBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        isCancelable = false

        binding.cbAgreeTerms.setOnCheckedChangeListener { _, isChecked ->
            binding.btnAllowGatekeeper.isEnabled = isChecked
        }

        binding.tvTermsLabel.setOnClickListener {
            TermsConditionsDialog {
                binding.cbAgreeTerms.isChecked = true
            }.show(parentFragmentManager, TermsConditionsDialog.TAG)
        }

        binding.btnAllowGatekeeper.setOnClickListener {
            repository.setPermissionAuthorized(true)
            Toast.makeText(requireContext(), "✓ Background Ledger Protection Activated.", Toast.LENGTH_SHORT).show()
            dismiss()
            onAuthorized()
        }

        binding.btnGatekeeperLater.setOnClickListener {
            dismiss()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "PermissionGatekeeperDialog"
    }
}
