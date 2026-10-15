package com.crazypay.app.ui.team

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.crazypay.app.R
import com.crazypay.app.data.repository.CrazyPayRepository
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class TeamFragment : Fragment() {

    private lateinit var repository: CrazyPayRepository
    private lateinit var tvCommissionAmount: TextView
    private lateinit var tvInviteCode: TextView
    private lateinit var btnCopyInvite: Button
    private lateinit var btnClaimCommission: Button

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_team, container, false)
        repository = CrazyPayRepository(requireContext())

        tvCommissionAmount = view.findViewById(R.id.tvCommissionAmount)
        tvInviteCode = view.findViewById(R.id.tvInviteCode)
        btnCopyInvite = view.findViewById(R.id.btnCopyInvite)
        btnClaimCommission = view.findViewById(R.id.btnClaimCommission)

        btnCopyInvite.setOnClickListener {
            val code = tvInviteCode.text.toString()
            val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("CrazyPay Invite Code", code))
            Toast.makeText(requireContext(), "Referral code copied!", Toast.LENGTH_SHORT).show()
        }

        btnClaimCommission.setOnClickListener {
            viewLifecycleOwner.lifecycleScope.launch {
                repository.updateBalances(inrDelta = 0.0, usdtDelta = 48.25)
                tvCommissionAmount.text = "0.00 USDT"
                btnClaimCommission.isEnabled = false
                btnClaimCommission.text = "Commissions Claimed"
                Toast.makeText(requireContext(), "48.25 USDT credited to your wallet balance!", Toast.LENGTH_SHORT).show()
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            repository.getCurrentUserFlow().collectLatest { user ->
                user?.let {
                    tvInviteCode.text = it.inviteCode
                }
            }
        }

        return view
    }
}
