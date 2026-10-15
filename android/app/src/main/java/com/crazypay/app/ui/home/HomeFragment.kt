package com.crazypay.app.ui.home

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.crazypay.app.R
import com.crazypay.app.data.repository.CrazyPayRepository
import com.crazypay.app.ui.MainActivity
import com.crazypay.app.ui.adapters.TradeAdapter
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.text.DecimalFormat

class HomeFragment : Fragment() {

    private lateinit var repository: CrazyPayRepository
    private lateinit var tradeAdapter: TradeAdapter

    private lateinit var tvInrBalance: TextView
    private lateinit var tvUsdtBalance: TextView
    private lateinit var tvMarketRate: TextView
    private lateinit var btnQuickBuy: Button
    private lateinit var btnQuickSell: Button
    private lateinit var rvRecentTrades: RecyclerView
    private lateinit var swipeRefresh: SwipeRefreshLayout

    private val inrFormat = DecimalFormat("#,##0.00")
    private val usdtFormat = DecimalFormat("0.0000")

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_home, container, false)
        repository = CrazyPayRepository(requireContext())

        tvInrBalance = view.findViewById(R.id.tvInrBalance)
        tvUsdtBalance = view.findViewById(R.id.tvUsdtBalance)
        tvMarketRate = view.findViewById(R.id.tvMarketRate)
        btnQuickBuy = view.findViewById(R.id.btnQuickBuy)
        btnQuickSell = view.findViewById(R.id.btnQuickSell)
        rvRecentTrades = view.findViewById(R.id.rvRecentTrades)
        swipeRefresh = view.findViewById(R.id.swipeRefresh)

        tradeAdapter = TradeAdapter(requireContext())
        rvRecentTrades.layoutManager = LinearLayoutManager(requireContext())
        rvRecentTrades.adapter = tradeAdapter

        setupListeners()
        observeData()

        return view
    }

    private fun setupListeners() {
        btnQuickBuy.setOnClickListener {
            (activity as? MainActivity)?.switchTab(R.id.navigation_trade)
        }

        btnQuickSell.setOnClickListener {
            (activity as? MainActivity)?.switchTab(R.id.navigation_trade)
        }

        swipeRefresh.setOnRefreshListener {
            swipeRefresh.isRefreshing = false
        }
    }

    private fun observeData() {
        viewLifecycleOwner.lifecycleScope.launch {
            repository.getCurrentUserFlow().collectLatest { user ->
                user?.let {
                    tvInrBalance.text = "₹" + inrFormat.format(it.balanceInr)
                    tvUsdtBalance.text = usdtFormat.format(it.balanceUsdt) + " USDT"
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            repository.getAllTradesFlow().collectLatest { trades ->
                tradeAdapter.submitList(trades.take(5))
            }
        }
    }
}
