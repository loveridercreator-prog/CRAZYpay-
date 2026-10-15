package com.crazypay.app.ui.trade

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.crazypay.app.R
import com.crazypay.app.data.repository.CrazyPayRepository
import com.crazypay.app.ui.adapters.TradeAdapter
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.text.DecimalFormat

class TradeFragment : Fragment() {

    private lateinit var repository: CrazyPayRepository
    private lateinit var tradeAdapter: TradeAdapter

    private lateinit var btnTabBuy: Button
    private lateinit var btnTabSell: Button
    private lateinit var etFiatAmount: EditText
    private lateinit var tvCalculatedUsdt: TextView
    private lateinit var tvExchangeRateInfo: TextView
    private lateinit var btnPlaceTrade: Button
    private lateinit var rvAllTrades: RecyclerView

    private var currentTradeType = "BUY"
    private val exchangeRate = 91.50
    private val decimalFormat = DecimalFormat("0.0000")

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_trade, container, false)
        repository = CrazyPayRepository(requireContext())

        btnTabBuy = view.findViewById(R.id.btnTabBuy)
        btnTabSell = view.findViewById(R.id.btnTabSell)
        etFiatAmount = view.findViewById(R.id.etFiatAmount)
        tvCalculatedUsdt = view.findViewById(R.id.tvCalculatedUsdt)
        tvExchangeRateInfo = view.findViewById(R.id.tvExchangeRateInfo)
        btnPlaceTrade = view.findViewById(R.id.btnPlaceTrade)
        rvAllTrades = view.findViewById(R.id.rvAllTrades)

        tradeAdapter = TradeAdapter(requireContext())
        rvAllTrades.layoutManager = LinearLayoutManager(requireContext())
        rvAllTrades.adapter = tradeAdapter

        setupTradeTabs()
        setupAmountWatcher()
        setupPlaceOrderAction()
        observeTrades()

        return view
    }

    private fun setupTradeTabs() {
        btnTabBuy.setOnClickListener {
            currentTradeType = "BUY"
            btnTabBuy.setBackgroundResource(R.drawable.bg_button_primary)
            btnTabBuy.setTextColor(resources.getColor(R.color.text_white, null))
            btnTabSell.setBackgroundColor(resources.getColor(R.color.transparent, null))
            btnTabSell.setTextColor(resources.getColor(R.color.text_muted, null))
            btnPlaceTrade.text = "Place Instant Buy Order"
            recalculateUsdt()
        }

        btnTabSell.setOnClickListener {
            currentTradeType = "SELL"
            btnTabSell.setBackgroundResource(R.drawable.bg_button_primary)
            btnTabSell.setTextColor(resources.getColor(R.color.text_white, null))
            btnTabBuy.setBackgroundColor(resources.getColor(R.color.transparent, null))
            btnTabBuy.setTextColor(resources.getColor(R.color.text_muted, null))
            btnPlaceTrade.text = "Place Instant Sell Order"
            recalculateUsdt()
        }
    }

    private fun setupAmountWatcher() {
        etFiatAmount.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {
                recalculateUsdt()
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun recalculateUsdt() {
        val inputStr = etFiatAmount.text.toString().trim()
        val fiat = inputStr.toDoubleOrNull() ?: 0.0
        val usdt = if (fiat > 0) fiat / exchangeRate else 0.0
        tvCalculatedUsdt.text = "${decimalFormat.format(usdt)} USDT"
    }

    private fun setupPlaceOrderAction() {
        btnPlaceTrade.setOnClickListener {
            val fiat = etFiatAmount.text.toString().trim().toDoubleOrNull()
            if (fiat == null || fiat < 100) {
                Toast.makeText(requireContext(), "Please enter minimum ₹100", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val usdt = fiat / exchangeRate

            viewLifecycleOwner.lifecycleScope.launch {
                val newOrder = repository.createTrade(
                    tradeType = currentTradeType,
                    assetAmount = usdt,
                    fiatAmount = fiat,
                    exchangeRate = exchangeRate
                )
                etFiatAmount.text.clear()
                Toast.makeText(requireContext(), "Order ${newOrder.orderId} Matched!", Toast.LENGTH_SHORT).show()

                // Immediately open Order Details screen for payment / settlement
                val intent = Intent(requireContext(), OrderDetailActivity::class.java).apply {
                    putExtra("EXTRA_ORDER_ID", newOrder.orderId)
                }
                startActivity(intent)
            }
        }
    }

    private fun observeTrades() {
        viewLifecycleOwner.lifecycleScope.launch {
            repository.getAllTradesFlow().collectLatest { trades ->
                tradeAdapter.submitList(trades)
            }
        }
    }
}
