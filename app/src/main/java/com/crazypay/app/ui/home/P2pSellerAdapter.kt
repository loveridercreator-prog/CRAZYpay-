package com.crazypay.app.ui.home

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.crazypay.app.data.model.P2pSeller
import com.crazypay.app.databinding.ItemP2pSellerBinding

class P2pSellerAdapter(
    private var sellers: List<P2pSeller>,
    private val onBuyClick: (P2pSeller) -> Unit
) : RecyclerView.Adapter<P2pSellerAdapter.SellerViewHolder>() {

    fun updateData(newSellers: List<P2pSeller>) {
        sellers = newSellers
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SellerViewHolder {
        val binding = ItemP2pSellerBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return SellerViewHolder(binding)
    }

    override fun onBindViewHolder(holder: SellerViewHolder, position: Int) {
        holder.bind(sellers[position])
    }

    override fun getItemCount(): Int = sellers.size

    inner class SellerViewHolder(private val binding: ItemP2pSellerBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(seller: P2pSeller) {
            binding.tvSellerName.text = seller.name
            binding.tvSellerStats.text = String.format("%,d orders | %.1f%% completion", seller.totalOrders, seller.completionRate.toDouble())
            binding.tvSellerPrice.text = String.format("₹ %.2f", seller.priceRate)
            binding.tvSellerLimits.text = String.format("Limit: ₹ %,.0f - ₹ %,.0f", seller.minLimit, seller.maxLimit)

            binding.btnBuySeller.setOnClickListener {
                onBuyClick(seller)
            }
        }
    }
}
