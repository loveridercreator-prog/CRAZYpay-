package com.crazypay.app.ui.profile

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.crazypay.app.data.model.UpiHandle
import com.crazypay.app.databinding.ItemUpiHandleBinding

class UpiHandleAdapter(
    private var handles: List<UpiHandle>
) : RecyclerView.Adapter<UpiHandleAdapter.UpiViewHolder>() {

    fun updateHandles(newHandles: List<UpiHandle>) {
        handles = newHandles
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): UpiViewHolder {
        val binding = ItemUpiHandleBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return UpiViewHolder(binding)
    }

    override fun onBindViewHolder(holder: UpiViewHolder, position: Int) {
        holder.bind(handles[position])
    }

    override fun getItemCount(): Int = handles.size

    inner class UpiViewHolder(private val binding: ItemUpiHandleBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(handle: UpiHandle) {
            binding.tvItemUpiId.text = handle.upiId
            binding.tvItemUpiHolder.text = String.format("%s (%s)", handle.accountHolder, handle.provider)
            binding.tvItemUpiBadge.visibility = if (handle.isPrimary) View.VISIBLE else View.GONE
        }
    }
}
