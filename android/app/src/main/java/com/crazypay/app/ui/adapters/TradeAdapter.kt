package com.crazypay.app.ui.adapters

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.crazypay.app.R
import com.crazypay.app.data.local.entities.TradeEntity
import com.crazypay.app.ui.trade.OrderDetailActivity
import java.text.DecimalFormat

class TradeAdapter(
    private val context: Context,
    private var trades: List<TradeEntity> = emptyList()
) : RecyclerView.Adapter<TradeAdapter.TradeViewHolder>() {

    private val inrFormat = DecimalFormat("#,##0.00")
    private val cryptoFormat = DecimalFormat("0.0000")

    fun submitList(newList: List<TradeEntity>) {
        trades = newList
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TradeViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_trade_order, parent, false)
        return TradeViewHolder(view)
    }

    override fun onBindViewHolder(holder: TradeViewHolder, position: Int) {
        val trade = trades[position]
        holder.tvOrderId.text = trade.orderId
        holder.tvTypeBadge.text = trade.tradeType
        holder.tvFiatAmount.text = "₹" + inrFormat.format(trade.fiatAmount)
        holder.tvCryptoAmount.text = cryptoFormat.format(trade.assetAmount) + " " + trade.asset
        holder.tvStatus.text = trade.status

        if (trade.tradeType == "BUY") {
            holder.tvTypeBadge.setBackgroundResource(R.drawable.bg_button_primary)
        } else {
            holder.tvTypeBadge.setBackgroundResource(R.drawable.bg_badge_pending)
        }

        if (trade.status == "COMPLETED") {
            holder.tvStatus.setBackgroundResource(R.drawable.bg_badge_active)
            holder.tvStatus.setTextColor(Color.parseColor("#10B981"))
        } else {
            holder.tvStatus.setBackgroundResource(R.drawable.bg_badge_pending)
            holder.tvStatus.setTextColor(Color.parseColor("#F59E0B"))
        }

        holder.itemView.setOnClickListener {
            val intent = Intent(context, OrderDetailActivity::class.java).apply {
                putExtra("EXTRA_ORDER_ID", trade.orderId)
            }
            context.startActivity(intent)
        }
    }

    override fun getItemCount(): Int = trades.size

    class TradeViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvTypeBadge: TextView = itemView.findViewById(R.id.tvOrderTypeBadge)
        val tvOrderId: TextView = itemView.findViewById(R.id.tvItemOrderId)
        val tvStatus: TextView = itemView.findViewById(R.id.tvItemStatus)
        val tvFiatAmount: TextView = itemView.findViewById(R.id.tvItemFiatAmount)
        val tvCryptoAmount: TextView = itemView.findViewById(R.id.tvItemCryptoAmount)
    }
}
