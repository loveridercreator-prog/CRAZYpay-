package com.crazypay.app.ui.trade

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.crazypay.app.data.model.OrderStatus
import com.crazypay.app.data.model.OrderType
import com.crazypay.app.data.model.P2pOrder
import com.crazypay.app.databinding.ItemTradeOrderBinding

class OrdersAdapter(
    private var orders: List<P2pOrder>,
    private val onOrderClick: (P2pOrder) -> Unit
) : RecyclerView.Adapter<OrdersAdapter.OrderViewHolder>() {

    fun updateOrders(newOrders: List<P2pOrder>) {
        orders = newOrders
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): OrderViewHolder {
        val binding = ItemTradeOrderBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return OrderViewHolder(binding)
    }

    override fun onBindViewHolder(holder: OrderViewHolder, position: Int) {
        holder.bind(orders[position])
    }

    override fun getItemCount(): Int = orders.size

    inner class OrderViewHolder(private val binding: ItemTradeOrderBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(order: P2pOrder) {
            binding.tvOrderId.text = "#" + order.id
            binding.tvOrderTypeBadge.text = if (order.orderType == OrderType.BUY) "BUY USDT" else "SELL USDT"
            binding.tvOrderStatus.text = order.status.name
            binding.tvOrderAmountInr.text = String.format("₹ %,.2f", order.amountInr)
            binding.tvOrderAmountUsdt.text = String.format("%.2f USDT", order.amountUsdt)
            binding.tvOrderSeller.text = "Merchant: " + order.sellerName

            if (order.status == OrderStatus.RELEASED) {
                binding.tvOrderStatus.setTextColor(binding.root.context.getColor(com.crazypay.app.R.color.success_green))
            } else {
                binding.tvOrderStatus.setTextColor(binding.root.context.getColor(com.crazypay.app.R.color.warning_amber))
            }

            binding.btnOrderAction.setOnClickListener {
                onOrderClick(order)
            }
            binding.root.setOnClickListener {
                onOrderClick(order)
            }
        }
    }
}
