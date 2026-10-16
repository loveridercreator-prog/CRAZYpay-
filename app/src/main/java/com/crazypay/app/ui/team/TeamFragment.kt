package com.crazypay.app.ui.team

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.crazypay.app.CrazyPayApplication
import com.crazypay.app.databinding.FragmentTeamBinding

class TeamFragment : Fragment() {

    private var _binding: FragmentTeamBinding? = null
    private val binding get() = _binding!!
    private val repository by lazy { (requireActivity().application as CrazyPayApplication).repository }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentTeamBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val user = repository.currentUser.value
        val inviteCode = user?.referralCode ?: "CP9708"
        binding.tvInviteCodeValue.text = inviteCode

        binding.btnCopyInviteCode.setOnClickListener {
            val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("Invite Code", inviteCode))
            Toast.makeText(requireContext(), "Referral code copied: $inviteCode", Toast.LENGTH_SHORT).show()
        }

        binding.btnShareReferral.setOnClickListener {
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, "Join CrazyPay P2P Trading")
                putExtra(Intent.EXTRA_TEXT, "Trade P2P crypto with instant INR escrow settlement on CrazyPay! Use my referral code: $inviteCode to claim ₹300 signup reward.")
            }
            startActivity(Intent.createChooser(shareIntent, "Share Referral Code"))
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
