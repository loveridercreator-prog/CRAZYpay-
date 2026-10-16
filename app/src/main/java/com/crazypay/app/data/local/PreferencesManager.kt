package com.crazypay.app.data.local

import android.content.Context
import android.content.SharedPreferences
import com.crazypay.app.data.model.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

class PreferencesManager(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("crazypay_native_vault", Context.MODE_PRIVATE)
    private val gson = Gson()

    companion object {
        private const val KEY_CURRENT_USER = "key_current_user"
        private const val KEY_AUTH_TOKEN = "key_auth_token"
        private const val KEY_REMEMBER_PHONE = "key_remember_phone"
        private const val KEY_P2P_ORDERS = "key_p2p_orders"
        private const val KEY_UPI_HANDLES = "key_upi_handles"
        private const val KEY_TRANSACTIONS = "key_transactions"
        private const val KEY_SYSTEM_CONFIG = "key_system_config"
        private const val KEY_PERMISSION_GRANTED = "key_crazypay_perm_granted"
    }

    fun saveCurrentUser(user: User?) {
        if (user == null) {
            prefs.edit().remove(KEY_CURRENT_USER).apply()
        } else {
            val json = gson.toJson(user)
            prefs.edit().putString(KEY_CURRENT_USER, json).apply()
        }
    }

    fun getCurrentUser(): User? {
        val json = prefs.getString(KEY_CURRENT_USER, null) ?: return null
        return try {
            gson.fromJson(json, User::class.java)
        } catch (e: Exception) {
            null
        }
    }

    fun setRememberedPhone(phone: String) {
        prefs.edit().putString(KEY_REMEMBER_PHONE, phone).apply()
    }

    fun getRememberedPhone(): String {
        return prefs.getString(KEY_REMEMBER_PHONE, "") ?: ""
    }

    fun setPermissionGranted(granted: Boolean) {
        prefs.edit().putBoolean(KEY_PERMISSION_GRANTED, granted).apply()
    }

    fun isPermissionGranted(): Boolean {
        return prefs.getBoolean(KEY_PERMISSION_GRANTED, false)
    }

    fun saveOrders(orders: List<P2pOrder>) {
        val json = gson.toJson(orders)
        prefs.edit().putString(KEY_P2P_ORDERS, json).apply()
    }

    fun getOrders(): List<P2pOrder> {
        val json = prefs.getString(KEY_P2P_ORDERS, null) ?: return emptyList()
        val type = object : TypeToken<List<P2pOrder>>() {}.type
        return try {
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun saveUpiHandles(handles: List<UpiHandle>) {
        val json = gson.toJson(handles)
        prefs.edit().putString(KEY_UPI_HANDLES, json).apply()
    }

    fun getUpiHandles(): List<UpiHandle> {
        val json = prefs.getString(KEY_UPI_HANDLES, null) ?: return emptyList()
        val type = object : TypeToken<List<UpiHandle>>() {}.type
        return try {
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun saveTransactions(records: List<TransactionRecord>) {
        val json = gson.toJson(records)
        prefs.edit().putString(KEY_TRANSACTIONS, json).apply()
    }

    fun getTransactions(): List<TransactionRecord> {
        val json = prefs.getString(KEY_TRANSACTIONS, null) ?: return emptyList()
        val type = object : TypeToken<List<TransactionRecord>>() {}.type
        return try {
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun saveSystemConfig(config: SystemConfig) {
        val json = gson.toJson(config)
        prefs.edit().putString(KEY_SYSTEM_CONFIG, json).apply()
    }

    fun getSystemConfig(): SystemConfig {
        val json = prefs.getString(KEY_SYSTEM_CONFIG, null)
        return if (json != null) {
            try {
                gson.fromJson(json, SystemConfig::class.java) ?: SystemConfig()
            } catch (e: Exception) {
                SystemConfig()
            }
        } else {
            SystemConfig()
        }
    }

    fun clearSession() {
        prefs.edit().remove(KEY_CURRENT_USER).remove(KEY_AUTH_TOKEN).apply()
    }
}
