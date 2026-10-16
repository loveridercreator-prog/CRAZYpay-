package com.crazypay.app.data.model

import java.io.Serializable

data class UpiHandle(
    val id: String,
    val upiId: String,
    val accountHolder: String,
    val provider: String = "Google Pay",
    val isPrimary: Boolean = true,
    val isActive: Boolean = true,
    val addedTimestamp: Long = System.currentTimeMillis()
) : Serializable
