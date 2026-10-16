package com.crazypay.app.ui.trade

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.crazypay.app.CrazyPayApplication
import com.crazypay.app.data.model.OrderStatus
import com.crazypay.app.databinding.FragmentTradesBinding
import com.google.android.material.tabs.TabLayout
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class TradesFragment : Fragment() {

    private var _binding: FragmentTradesBinding? = null
    private val binding get() = _binding!!
    private val repository by lazy { (requireActivity().application as CrazyPayApplication).repository }
    private lateinit var ordersAdapter: OrdersAdapter
    private var filterTab = 0 // 0: All, 1: Active, 2: Completed

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentTradesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()
        setupTabs()
        observeOrders()
    }

    private fun setupRecyclerView() {
        ordersAdapter = OrdersAdapter(emptyList()) { order ->
            val intent = Intent(requireContext(), OrderDetailActivity::class.java).apply {
                putExtra("EXTRA_ORDER_ID", order.id)
            }
            startActivity(intent)
        }
        binding.rvOrders.layoutManager = LinearLayoutManager(requireContext())
        binding.rvOrders.adapter = ordersAdapter
    }

    private fun setupTabs() {
        binding.tabLayoutOrders.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                filterTab = tab?.position ?: 0
                filterAndDisplayOrders()
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
    }

    private fun observeOrders() {
        viewLifecycleOwner.lifecycleScope.launch {
            repository.orders.collectLatest {
                filterAndDisplayOrders()
            }
        }
    }

    private fun filterAndDisplayOrders() {
        val allOrders = repository.orders.value
        val filtered = when (filterTab) {
            1 -> allOrders.filter { it.status == OrderStatus.PENDING || it.status == OrderStatus.PAID }
            2 -> allOrders.filter { it.status == OrderStatus.RELEASED || it.status == OrderStatus.COMPLETED }
            else -> allOrders
        }

        ordersAdapter.updateOrders(filtered)
        binding.tvEmptyOrders.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
