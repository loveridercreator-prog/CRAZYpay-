/**
 * CRAZYPAY SINGLE-BINDING ACCOUNT MANAGER
 * ============================================================================
 * Enforces the Single Binding Rule:
 * "A CrazyPay trading account may have only ONE active payment identifier binding at a time."
 * Implements atomic locks, idempotency, unbinding/rebinding, and audit logging.
 * ============================================================================
 */

import { PaymentIdentifier } from "../providers/types";

export interface AccountBinding {
  bindingId: string;
  userId: string;
  providerId: string;
  paymentIdentifier: PaymentIdentifier;
  boundAt: number;
  unboundAt?: number;
  isActive: boolean;
  bindingVersion: number;
  auditTrail: {
    action: "BIND" | "UNBIND" | "REPLACE";
    timestamp: number;
    actor: string;
    reason?: string;
  }[];
}

class SingleBindingManager {
  private activeBindings: Map<string, AccountBinding> = new Map(); // Key: userId
  private bindingLocks: Map<string, Promise<void>> = new Map();

  constructor() {
    this.seedDefaultBindings();
  }

  private seedDefaultBindings() {
    // Seed default verified seller binding
    const demoSellerId = "usr_demo_seller_1";
    this.activeBindings.set(demoSellerId, {
      bindingId: "bind_demo_seller_1",
      userId: demoSellerId,
      providerId: "mock_upi_gateway",
      paymentIdentifier: {
        id: "id_upi_1",
        type: "UPI_ID",
        value: "crazypay.seller@okaxis",
        accountHolderName: "CrazyPay Verified Merchant",
        provider: "mock_upi_gateway",
        isDefault: true,
        status: "ACTIVE",
      },
      boundAt: Date.now() - 1000 * 60 * 60 * 24,
      isActive: true,
      bindingVersion: 1,
      auditTrail: [
        {
          action: "BIND",
          timestamp: Date.now() - 1000 * 60 * 60 * 24,
          actor: demoSellerId,
          reason: "Initial authorized provider binding",
        },
      ],
    });
  }

  /**
   * Acquire atomic lock for user binding mutation
   */
  private async acquireLock(userId: string): Promise<() => void> {
    while (this.bindingLocks.has(userId)) {
      await this.bindingLocks.get(userId);
    }
    let resolveLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.bindingLocks.set(userId, lockPromise);

    return () => {
      this.bindingLocks.delete(userId);
      resolveLock();
    };
  }

  /**
   * Get active bound identifier for a user (Only 1 allowed)
   */
  async getActiveBinding(userId: string): Promise<AccountBinding | null> {
    const binding = this.activeBindings.get(userId);
    return binding && binding.isActive ? binding : null;
  }

  /**
   * Atomically bind a new payment identifier (Enforces Single Binding Rule)
   */
  async bindIdentifier(
    userId: string,
    providerId: string,
    identifier: PaymentIdentifier,
    actor: string = userId,
    idempotencyKey?: string,
  ): Promise<AccountBinding> {
    const releaseLock = await this.acquireLock(userId);
    try {
      const existing = this.activeBindings.get(userId);

      // Check if already bound with same identifier
      if (
        existing &&
        existing.isActive &&
        existing.paymentIdentifier.value.toLowerCase() === identifier.value.toLowerCase()
      ) {
        return existing;
      }

      // If active binding exists, atomically unbind old one and log
      const now = Date.now();
      const version = existing ? existing.bindingVersion + 1 : 1;
      const history = existing ? [...existing.auditTrail] : [];

      history.push({
        action: existing && existing.isActive ? "REPLACE" : "BIND",
        timestamp: now,
        actor,
        reason: `Bound ${identifier.type}: ${identifier.value} via ${providerId}${idempotencyKey ? ` [Key: ${idempotencyKey}]` : ""}`,
      });

      const newBinding: AccountBinding = {
        bindingId: `bind_${userId}_${now}`,
        userId,
        providerId,
        paymentIdentifier: { ...identifier, isDefault: true, status: "ACTIVE" },
        boundAt: now,
        isActive: true,
        bindingVersion: version,
        auditTrail: history,
      };

      this.activeBindings.set(userId, newBinding);
      return newBinding;
    } finally {
      releaseLock();
    }
  }

  /**
   * Safely unbind the active identifier
   */
  async unbindIdentifier(
    userId: string,
    actor: string = userId,
    reason: string = "User requested unbind",
  ): Promise<boolean> {
    const releaseLock = await this.acquireLock(userId);
    try {
      const existing = this.activeBindings.get(userId);
      if (!existing || !existing.isActive) {
        return false;
      }

      const now = Date.now();
      existing.isActive = false;
      existing.unboundAt = now;
      existing.auditTrail.push({
        action: "UNBIND",
        timestamp: now,
        actor,
        reason,
      });

      return true;
    } finally {
      releaseLock();
    }
  }
}

export const singleBindingManager = new SingleBindingManager();
