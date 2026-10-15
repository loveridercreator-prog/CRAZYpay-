package com.crazypay.app.ui.upi

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.crazypay.app.R
import com.crazypay.app.data.repository.CrazyPayRepository
import com.crazypay.app.ui.adapters.UpiAccountAdapter
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class UpiFragment : Fragment() {

    private lateinit var repository: CrazyPayRepository
    private lateinit var adapter: UpiAccountAdapter

    private lateinit var tvActiveUpiValue: TextView
    private lateinit var tvActiveHolderName: TextView
    private lateinit var btnAddUpi: Button
    private lateinit var rvUpiAccounts: RecyclerView

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_upi, container, false)
        repository = CrazyPayRepository(requireContext())

        tvActiveUpiValue = view.findViewById(R.id.tvActiveUpiValue)
        tvActiveHolderName = view.findViewById(R.id.tvActiveHolderName)
        btnAddUpi = view.findViewById(R.id.btnAddUpi)
        rvUpiAccounts = view.findViewById(R.id.rvUpiAccounts)

        adapter = UpiAccountAdapter(requireContext()) { targetAccount ->
            // Enforce Single Active Binding
            viewLifecycleOwner.lifecycleScope.launch {
                repository.setActiveBinding(targetAccount.id)
                Toast.makeText(requireContext(), "${targetAccount.identifierValue} is now your Active Binding!", Toast.LENGTH_SHORT).show()
            }
        }

        rvUpiAccounts.layoutManager = LinearLayoutManager(requireContext())
        rvUpiAccounts.adapter = adapter

        btnAddUpi.setOnClickListener { showAddUpiDialog() }
        observeUpiData()

        return view
    }

    private fun observeUpiData() {
        viewLifecycleOwner.lifecycleScope.launch {
            repository.getActiveUpiFlow().collectLatest { active ->
                if (active != null) {
                    tvActiveUpiValue.text = active.identifierValue
                    tvActiveHolderName.text = "Holder: ${active.accountHolderName}"
                } else {
                    tvActiveUpiValue.text = "No Active Binding"
                    tvActiveHolderName.text = "Please bind a UPI identifier to receive settlements"
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            repository.getAllUpiFlow().collectLatest { accounts ->
                adapter.submitList(accounts)
            }
        }
    }

    private fun showAddUpiDialog() {
        val dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_add_upi, null)
        val etUpi = dialogView.findViewById<EditText>(R.id.dialogEtUpiValue)
        val etHolder = dialogView.findViewById<EditText>(R.id.dialogEtHolderName)
        val cbActive = dialogView.findViewById<CheckBox>(R.id.dialogCbSetActive)
        val btnSave = dialogView.findViewById<Button>(R.id.dialogBtnSaveUpi)

        val dialog = AlertDialog.Builder(requireContext())
            .setView(dialogView)
            .create()

        btnSave.setOnClickListener {
            val upi = etUpi.text.toString().trim()
            val holder = etHolder.text.toString().trim()

            if (upi.isEmpty() || !upi.contains("@")) {
                Toast.makeText(requireContext(), "Please enter a valid UPI ID (e.g. name@bank)", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (holder.isEmpty()) {
                Toast.makeText(requireContext(), "Please enter account holder name", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            viewLifecycleOwner.lifecycleScope.launch {
                repository.addUpiIdentifier(
                    type = "UPI_ID",
                    value = upi,
                    holderName = holder,
                    setActive = cbActive.isChecked
                )
                dialog.dismiss()
                Toast.makeText(requireContext(), "UPI Identifier bound successfully!", Toast.LENGTH_SHORT).show()
            }
        }

        dialog.show()
    }
}
