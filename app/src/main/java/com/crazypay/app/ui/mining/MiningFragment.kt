package com.crazypay.app.ui.mining

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.crazypay.app.CrazyPayApplication
import com.crazypay.app.databinding.FragmentMiningBinding

class MiningFragment : Fragment() {

    private var _binding: FragmentMiningBinding? = null
    private val binding get() = _binding!!
    private val repository by lazy { (requireActivity().application as CrazyPayApplication).repository }

    private var accruedReward = 12.85

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentMiningBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.tvTotalMiningEarned.text = String.format("+ %.2f USDT", accruedReward)

        binding.btnClaimMining.setOnClickListener {
            if (accruedReward <= 0) {
                Toast.makeText(requireContext(), "No new rewards to claim currently.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val user = repository.currentUser.value
            if (user != null) {
                repository.login(user.phone, "dummy") // keep session
            }
            Toast.makeText(requireContext(), String.format("✓ Claimed %.2f USDT to your trading balance!", accruedReward), Toast.LENGTH_LONG).show()
            accruedReward = 0.0
            binding.tvTotalMiningEarned.text = "+ 0.00 USDT"
        }

        binding.btnSubscribePool1.setOnClickListener {
            Toast.makeText(requireContext(), "Subscribed to Flash OTC Arbitrage with 50 USDT.", Toast.LENGTH_LONG).show()
        }

        binding.btnSubscribePool2.setOnClickListener {
            Toast.makeText(requireContext(), "Subscribed to Liquidity Sweep Node with 200 USDT.", Toast.LENGTH_LONG).show()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
