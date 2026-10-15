package com.crazypay.app.ui.adapters

import android.content.Context
import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.crazypay.app.R
import com.crazypay.app.data.local.entities.PaymentIdentifierEntity

class UpiAccountAdapter(
    private val context: Context,
    private var accounts: List<PaymentIdentifierEntity> = emptyList(),
    private val onToggleActive: (PaymentIdentifierEntity) -> Unit
) : RecyclerView.Adapter<UpiAccountAdapter.UpiViewHolder>() {

    fun submitList(newList: List<PaymentIdentifierEntity>) {
        accounts = newList
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): UpiViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_upi_account, parent, false)
        return UpiViewHolder(view)
    }

    override fun onBindViewHolder(holder: UpiViewHolder, position: Int) {
        val item = accounts[position]
        holder.tvUpiValue.text = item.identifierValue
        holder.tvHolderName.text = "Holder: " + item.accountHolderName
        holder.tvUpiType.text = item.identifierType

        if (item.isActiveBinding) {
            holder.btnToggleActive.text = "ACTIVE"
            holder.btnToggleActive.setBackgroundResource(R.drawable.bg_badge_active)
            holder.btnToggleActive.setTextColor(Color.parseColor("#10B981"))
            holder.btnToggleActive.isEnabled = false
        } else {
            holder.btnToggleActive.text = "ACTIVATE"
            holder.btnToggleActive.setBackgroundResource(R.drawable.bg_card_secondary)
            holder.btnToggleActive.setTextColor(Color.parseColor("#94A3B8"))
            holder.btnToggleActive.isEnabled = true
            holder.btnToggleActive.setOnClickListener {
                onToggleActive(item)
            }
        }
    }

    override fun getItemCount(): Int = accounts.size

    class UpiViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvUpiValue: TextView = itemView.findViewById(R.id.tvUpiValue)
        val tvHolderName: TextView = itemView.findViewById(R.id.tvHolderName)
        val tvUpiType: TextView = itemView.findViewById(R.id.tvUpiType)
        val btnToggleActive: Button = itemView.findViewById(R.id.btnToggleActive)
    }
}
