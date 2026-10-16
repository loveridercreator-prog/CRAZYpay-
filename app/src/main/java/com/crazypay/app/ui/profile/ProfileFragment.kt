package com.crazypay.app.ui.profile

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.crazypay.app.CrazyPayApplication
import com.crazypay.app.databinding.FragmentProfileBinding
import com.crazypay.app.ui.auth.AuthActivity
import com.crazypay.app.ui.dialogs.TermsConditionsDialog
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class ProfileFragment : Fragment() {

    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!
    private val repository by lazy { (requireActivity().application as CrazyPayApplication).repository }
    private lateinit var upiAdapter: UpiHandleAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupUpiRecyclerView()
        setupListeners()
        observeData()
    }

    private fun setupUpiRecyclerView() {
        upiAdapter = UpiHandleAdapter(emptyList())
        binding.rvUpiHandles.layoutManager = LinearLayoutManager(requireContext())
        binding.rvUpiHandles.adapter = upiAdapter
    }

    private fun setupListeners() {
        binding.btnLinkNewUpi.setOnClickListener {
            LinkUpiBottomSheetDialog().show(parentFragmentManager, LinkUpiBottomSheetDialog.TAG)
        }

        binding.btnTelegramSupport.setOnClickListener {
            val url = repository.systemConfig.value.telegramSupportUrl
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (e: Exception) {
                Toast.makeText(requireContext(), "Telegram Support: @crazypay_official_support", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnOpenTerms.setOnClickListener {
            TermsConditionsDialog {}.show(parentFragmentManager, TermsConditionsDialog.TAG)
        }

        binding.btnLogout.setOnClickListener {
            repository.logout()
            val intent = Intent(requireContext(), AuthActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
            startActivity(intent)
            requireActivity().finish()
        }
    }

    private fun observeData() {
        viewLifecycleOwner.lifecycleScope.launch {
            repository.currentUser.collectLatest { user ->
                if (user != null) {
                    binding.tvProfilePhone.text = "+91 " + user.phone
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            repository.upiHandles.collectLatest { handles ->
                upiAdapter.updateHandles(handles)
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
