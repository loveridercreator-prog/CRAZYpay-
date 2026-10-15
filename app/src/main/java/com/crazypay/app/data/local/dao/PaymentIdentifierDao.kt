package com.crazypay.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.crazypay.app.data.local.entities.PaymentIdentifierEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PaymentIdentifierDao {
    @Query("SELECT * FROM payment_identifiers ORDER BY createdAt DESC")
    fun getAllIdentifiersFlow(): Flow<List<PaymentIdentifierEntity>>

    @Query("SELECT * FROM payment_identifiers WHERE is_active_binding = 1 LIMIT 1")
    suspend fun getActiveBinding(): PaymentIdentifierEntity?

    @Query("SELECT * FROM payment_identifiers WHERE is_active_binding = 1 LIMIT 1")
    fun getActiveBindingFlow(): Flow<PaymentIdentifierEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertIdentifier(identifier: PaymentIdentifierEntity)

    @Update
    suspend fun updateIdentifier(identifier: PaymentIdentifierEntity)

    @Query("UPDATE payment_identifiers SET is_active_binding = 0")
    suspend fun unbindAll()

    @Query("UPDATE payment_identifiers SET is_active_binding = 1 WHERE id = :id")
    suspend fun markActive(id: String)

    /**
     * Atomically enforces the Single Active Binding rule:
     * Unbinds all other payment identifiers, then activates the target identifier.
     */
    @Transaction
    suspend fun setActiveBindingAtomically(targetId: String) {
        unbindAll()
        markActive(targetId)
    }

    @Query("DELETE FROM payment_identifiers WHERE id = :id")
    suspend fun deleteById(id: String)
}
