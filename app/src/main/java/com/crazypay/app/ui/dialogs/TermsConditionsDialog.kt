package com.crazypay.app.ui.dialogs

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.crazypay.app.databinding.DialogTermsConditionsBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class TermsConditionsDialog(
    private val onAgree: () -> Unit
) : BottomSheetDialogFragment() {

    private var _binding: DialogTermsConditionsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogTermsConditionsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.btnAgreeTermsClose.setOnClickListener {
            onAgree()
            dismiss()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "TermsConditionsDialog"
    }
}
