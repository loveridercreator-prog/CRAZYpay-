package com.crazypay.app.ui.home

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.crazypay.app.CrazyPayApplication
import com.crazypay.app.R
import com.crazypay.app.databinding.FragmentHomeBinding
import com.crazypay.app.ui.admin.AdminPanelActivity
import com.crazypay.app.ui.trade.BuyBottomSheetDialog
import com.crazypay.app.ui.trade.SellBottomSheetDialog
import com.crazypay.app.ui.trade.WithdrawBottomSheetDialog
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!

    private val repository by lazy { (requireActivity().application as CrazyPayApplication).repository }
    private lateinit var sellerAdapter: P2pSellerAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()
        setupListeners()
        observeData()
    }

    private fun setupRecyclerView() {
        sellerAdapter = P2pSellerAdapter(emptyList()) { seller ->
            BuyBottomSheetDialog(seller).show(parentFragmentManager, BuyBottomSheetDialog.TAG)
        }
        binding.rvSellers.layoutManager = LinearLayoutManager(requireContext())
        binding.rvSellers.adapter = sellerAdapter
        sellerAdapter.updateData(repository.getMarketplaceSellers())
    }

    private fun setupListeners() {
        binding.swipeRefreshHome.setOnRefreshListener {
            sellerAdapter.updateData(repository.getMarketplaceSellers())
            binding.swipeRefreshHome.isRefreshing = false
        }

        binding.btnQuickBuy.setOnClickListener {
            val sellers = repository.getMarketplaceSellers()
            if (sellers.isNotEmpty()) {
                BuyBottomSheetDialog(sellers[0]).show(parentFragmentManager, BuyBottomSheetDialog.TAG)
            }
        }

        binding.btnQuickSell.setOnClickListener {
            SellBottomSheetDialog().show(parentFragmentManager, SellBottomSheetDialog.TAG)
        }

        binding.btnQuickWithdraw.setOnClickListener {
            WithdrawBottomSheetDialog().show(parentFragmentManager, WithdrawBottomSheetDialog.TAG)
        }

        binding.btnAdminConsole.setOnClickListener {
            startActivity(Intent(requireContext(), AdminPanelActivity::class.java))
        }
    }

    private fun observeData() {
        viewLifecycleOwner.lifecycleScope.launch {
            repository.currentUser.collectLatest { user ->
                if (user != null) {
                    binding.tvUserPhone.text = "+91 " + user.phone
                    binding.tvBalanceInr.text = String.format("₹ %,.2f", user.balance)
                    binding.tvBalanceUsdt.text = String.format("≈ %,.2f USDT", user.usdtBalance)
                    binding.tvTodayProfit.text = String.format("+₹ %,.2f", user.todayProfit)
                    binding.tvTotalCommission.text = String.format("₹ %,.2f", user.totalCommission)
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            repository.systemConfig.collectLatest { config ->
                binding.tvLiveRateTicker.text = String.format("1 USDT = ₹ %.2f", config.usdtExchangeRate)
                if (config.isServiceOnline) {
                    binding.tvServiceStatus.text = "Service Online"
                    binding.tvServiceStatus.setTextColor(requireContext().getColor(R.color.success_green))
                    binding.dotServiceStatus.setBackgroundColor(requireContext().getColor(R.color.success_green))
                } else {
                    binding.tvServiceStatus.text = "Service Offline"
                    binding.tvServiceStatus.setTextColor(requireContext().getColor(R.color.danger_red))
                    binding.dotServiceStatus.setBackgroundColor(requireContext().getColor(R.color.danger_red))
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
