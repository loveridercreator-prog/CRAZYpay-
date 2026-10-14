/**
 * CRAZYPAY P2P TRADE ENGINE - DETERMINISTIC STATE MACHINE
 * ============================================================================
 * Rigorous state transition engine ensuring financial safety.
 * Only valid transitions are permitted; invalid transitions throw errors.
 * ============================================================================
 */

export type TradeStatus =
  | "OPEN" // Order created in marketplace
  | "MATCHED" // Buyer matched with Seller
  | "PAYMENT_PENDING" // Buyer has active trade window to initiate payment
  | "PAYMENT_DETECTED" // Reference/UTR submitted by buyer or provider ping received
  | "VERIFICATION_PENDING" // Server-side matching against bank feed in progress
  | "VERIFIED" // Server-side bank transaction verified (12-digit UTR, Amount, Time)
  | "COMPLETED" // Assets released, trade finalized
  | "CANCELLED" // Cancelled by user before payment
  | "EXPIRED" // Trade window expired before payment/verification
  | "FAILED" // Verification failed (amount mismatch, invalid UTR, fake ref)
  | "DISPUTED"; // Under manual escrow dispute resolution

export interface TradeEvent {
  eventId: string;
  tradeId: string;
  fromStatus: TradeStatus;
  toStatus: TradeStatus;
  triggeredBy: string; // userId, 'SYSTEM_WORKER', 'VERIFICATION_ENGINE'
  reason?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface P2pTrade {
  tradeId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  asset: "USDT" | "BTC" | "INR_BALANCE";
  assetAmount: number;
  fiatCurrency: "INR";
  fiatAmount: number;
  exchangeRate: number; // e.g. 91.50 INR per USDT
  paymentMethod: "UPI" | "IMPS" | "BANK_TRANSFER";
  boundPaymentIdentifier: string; // e.g. "crazypay.seller@okaxis"
  sellerAccountHolder: string;
  expectedPaymentReference?: string;
  submittedUtr?: string;
  status: TradeStatus;
  createdAt: number;
  matchedAt?: number;
  expiresAt: number;
  paymentDetectedAt?: number;
  verifiedAt?: number;
  completedAt?: number;
  verificationAttempts: number;
  verificationAuditLog: string[];
  idempotencyKey?: string;
}

const ALLOWED_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = {
  OPEN: ["MATCHED", "CANCELLED", "EXPIRED"],
  MATCHED: ["PAYMENT_PENDING", "CANCELLED", "EXPIRED"],
  PAYMENT_PENDING: ["PAYMENT_DETECTED", "VERIFICATION_PENDING", "CANCELLED", "EXPIRED"],
  PAYMENT_DETECTED: ["VERIFICATION_PENDING", "EXPIRED", "FAILED", "DISPUTED"],
  VERIFICATION_PENDING: ["VERIFIED", "FAILED", "DISPUTED", "EXPIRED"],
  VERIFIED: ["COMPLETED", "DISPUTED"],
  COMPLETED: [], // Terminal
  CANCELLED: [], // Terminal
  EXPIRED: [], // Terminal
  FAILED: ["PAYMENT_PENDING", "DISPUTED"], // Allow retry if within timer or dispute
  DISPUTED: ["VERIFIED", "COMPLETED", "CANCELLED", "FAILED"],
};

export class TradeStateMachine {
  static canTransition(from: TradeStatus, to: TradeStatus): boolean {
    const allowed = ALLOWED_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  static transition(
    trade: P2pTrade,
    to: TradeStatus,
    triggeredBy: string,
    reason?: string,
    metadata?: Record<string, unknown>,
  ): { trade: P2pTrade; event: TradeEvent } {
    if (!this.canTransition(trade.status, to)) {
      throw new Error(
        `Invalid P2P trade transition from status '${trade.status}' to '${to}' for trade ${trade.tradeId}`,
      );
    }

    const now = Date.now();
    const prevStatus = trade.status;
    const updatedTrade: P2pTrade = {
      ...trade,
      status: to,
      verificationAuditLog: [
        ...trade.verificationAuditLog,
        `[${new Date(now).toISOString()}] [${triggeredBy}] Status: ${prevStatus} -> ${to}${reason ? ` (${reason})` : ""}`,
      ],
    };

    if (to === "MATCHED" && !updatedTrade.matchedAt) updatedTrade.matchedAt = now;
    if (to === "PAYMENT_DETECTED" && !updatedTrade.paymentDetectedAt)
      updatedTrade.paymentDetectedAt = now;
    if (to === "VERIFIED" && !updatedTrade.verifiedAt) updatedTrade.verifiedAt = now;
    if (to === "COMPLETED" && !updatedTrade.completedAt) updatedTrade.completedAt = now;

    const event: TradeEvent = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tradeId: trade.tradeId,
      fromStatus: prevStatus,
      toStatus: to,
      triggeredBy,
      reason,
      timestamp: now,
      metadata,
    };

    return { trade: updatedTrade, event };
  }
}
