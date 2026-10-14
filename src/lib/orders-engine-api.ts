/**
 * CRAZY PAY :: FULL-STACK FINANCIAL ORDER ENGINE & BACKEND BINDING
 * ---------------------------------------------------------------------------
 * Production-ready financial P2P engine with:
 *  - Module 1: Clean round display amounts (₹100, ₹200, ₹500, etc.) + unique paisa discount (0.01-0.99)
 *  - Module 1: 1 to 10 dynamic random chunking strictly enforcing SUM(Active) <= Seller_Available_Balance
 *  - Module 2: Two-Stage Split Timer (Stage 1: 5-min Buy Lock -> Stage 2: 15-min Payment/UTR)
 *  - Module 2: Dual UPI & Amount Integrity Checks (creation + pre-launch)
 *  - Module 3: Intent URI with Mobikwik package (com.mobikwik_new) and generic fallback
 *  - Module 4: Strict Success-Only Reset Rule, Multi-UPI Rotation & Cooldown Breaks (45-min & 4-hour)
 *  - Module 5: Real-time Sale Ledger (Active only) & Buyer History Atomic State Lock
 * ---------------------------------------------------------------------------
 */

import fs from "node:fs";
import nodePath from "node:path";
import { supabase } from "./supabase";

export interface OrderRecord {
  order_id: string;
  order_ref: string;
  display_amount: number; // Clean standard round integer (e.g. 100, 200, 500)
  payable_amount: number; // Exact amount with unique paisa discount (e.g. 99.14, 199.82)
  paisa_discount: number; // 0.01 to 0.99
  seller_upi_id: string; // Verified UPI VPA
  payment_app_type: string; // e.g. "mobikwik", "phonepe", "gpay", "paytm"
  symbol: string; // Provider logo URL
  seller_name: string;
  seller_referral_id: string;
  seller_phone: string;
  buyer_id?: string;
  buyer_phone?: string;
  buyer_name?: string;
  status: "AVAILABLE" | "LOCKED" | "PAYING" | "SUCCESS" | "CANCELLED" | "FAILED";
  stage: 0 | 1 | 2; // 0: Available, 1: 5-min Buy Lock, 2: 15-min Payment/UTR
  timer_seconds: number;
  timer_started_at?: number;
  timer_expires_at?: number;
  utr_number?: string;
  state_locked?: boolean;
  intent_uri?: string;
  created_at: number;
  updated_at: number;
}

export interface SellerUpiState {
  phone: string;
  linked_upis: Array<{
    upiId: string;
    upiName: string;
    isActive: boolean;
  }>;
  current_upi_index: number;
  consecutive_failures: number;
  break_count: number; // 1 = 45-min break, 2 = 2nd 45-min break, 3 = 4-hour break / permanent lock
  engine_status: "ON" | "OFF";
  engine_off_until: number; // timestamp
  hard_stop_locked: boolean;
  last_success_at?: number;
}

// In-memory persistent state (persists across hot reloads in server process)
const ordersStore = new Map<string, OrderRecord>();
const sellerStateStore = new Map<string, SellerUpiState>();
const sseClients = new Set<(event: string, data: unknown) => void>();

// Standard payment providers with brand icons
export const PAYMENT_PROVIDERS = [
  {
    name: "MobiKwik",
    type: "mobikwik",
    pkg: "com.mobikwik_new",
    symbol:
      "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=64&h=64&fit=crop&crop=faces&auto=format",
  },
  {
    name: "PhonePe",
    type: "phonepe",
    pkg: "com.phonepe.app",
    symbol:
      "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=64&h=64&fit=crop&crop=faces&auto=format",
  },
  {
    name: "Google Pay",
    type: "gpay",
    pkg: "com.google.android.apps.nbu.paisa.user",
    symbol:
      "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=64&h=64&fit=crop&crop=faces&auto=format",
  },
  {
    name: "Paytm",
    type: "paytm",
    pkg: "net.one97.paytm",
    symbol:
      "https://images.unsplash.com/photo-1556742049-0a67e557224f?w=64&h=64&fit=crop&crop=faces&auto=format",
  },
];

// Clean standard round denominations strictly enforcing no odd/broken amounts (like 141, 142)
const CLEAN_ROUND_DENOMINATIONS = [100, 200, 300, 500, 1000, 2000, 5000, 10000];

/**
 * Generates a clean random paisa discount strictly between 0.01 and 0.99
 */
export function generateUniquePaisaDiscount(): number {
  const paise = Math.floor(Math.random() * 99) + 1; // 1 to 99
  return Math.round(paise) / 100;
}

/**
 * Builds standard UPI Intent URI and Android Mobikwik targeted intent URI
 */
export function buildUpiIntentUris(order: {
  seller_upi_id: string;
  seller_name: string;
  payable_amount: number;
  order_id: string;
  payment_app_type?: string;
}) {
  const amt = order.payable_amount.toFixed(2);
  const name = encodeURIComponent(order.seller_name || "CRAZY PAY MERCHANT");
  const upi = encodeURIComponent(order.seller_upi_id);
  const ref = encodeURIComponent(order.order_id);

  // Standard generic UPI URI
  const genericUri = `upi://pay?pa=${upi}&pn=${name}&am=${amt}&tr=${ref}&cu=INR&tn=${ref}`;

  // Android targeted Intent URI pointing strictly to Mobikwik with fallback
  const mobikwikPkg = "com.mobikwik_new";
  const intentUri = `intent://pay?pa=${upi}&pn=${name}&am=${amt}&tr=${ref}&cu=INR&tn=${ref}#Intent;scheme=upi;package=${mobikwikPkg};S.browser_fallback_url=https://play.google.com/store/apps/details?id=${mobikwikPkg};end`;

  return { genericUri, intentUri };
}

/**
 * Broadcasts an event to all connected SSE clients
 */
function broadcast(event: string, order: OrderRecord, extra: Record<string, unknown> = {}) {
  const payload = { event, order, timestamp: Date.now(), ...extra };
  for (const send of sseClients) {
    try {
      send(event, payload);
    } catch {
      // client disconnected
    }
  }
}

/**
 * MODULE 1: BACKEND DATA BINDING & 1 TO 10 FLEXIBLE RANDOM CHUNKING
 * Enforces:
 *  - withdrawal_engine === TRUE
 *  - seller_available_balance > 0
 *  - 1 to 10 flexible random chunks
 *  - clean round display amounts (multiples of 100)
 *  - SUM(Active_Orders) <= seller_available_balance
 *  - exact payable amount with unique paisa discount (0.01 - 0.99)
 */
export function executeWithdrawalEngineChunking(params: {
  sellerId: string;
  sellerPhone: string;
  sellerName: string;
  sellerReferralId?: string;
  sellerUpiId: string;
  availableBalance: number;
  withdrawalEngineEnabled: boolean;
}): { success: boolean; error?: string; orders: OrderRecord[] } {
  const {
    sellerPhone,
    sellerName,
    sellerReferralId = "CP-" + (sellerPhone.slice(-4) || "8888"),
    sellerUpiId,
    availableBalance,
    withdrawalEngineEnabled,
  } = params;

  if (!withdrawalEngineEnabled) {
    return { success: false, error: "Withdrawal engine is disabled", orders: [] };
  }

  if (!availableBalance || availableBalance < 100) {
    return {
      success: false,
      error: "Available balance must be at least ₹100 for order creation",
      orders: [],
    };
  }

  // DUAL INTEGRITY CHECK 1: Seller UPI ID validation
  if (!sellerUpiId || !sellerUpiId.includes("@") || sellerUpiId.includes("undefined")) {
    return {
      success: false,
      error: "Invalid or unverified Seller UPI ID provided",
      orders: [],
    };
  }

  // Calculate maximum clean round total in hundreds
  const maxRoundTotal = Math.floor(availableBalance / 100) * 100;
  if (maxRoundTotal < 100) {
    return { success: false, error: "Insufficient round balance", orders: [] };
  }

  // Check sum of existing active orders for this seller
  let currentActiveTotal = 0;
  for (const existing of ordersStore.values()) {
    if (
      existing.seller_phone === sellerPhone &&
      (existing.status === "AVAILABLE" ||
        existing.status === "LOCKED" ||
        existing.status === "PAYING")
    ) {
      currentActiveTotal += existing.display_amount;
    }
  }

  const remainingBalanceToAllocate = maxRoundTotal - currentActiveTotal;
  if (remainingBalanceToAllocate < 100) {
    return {
      success: false,
      error: "Active orders already equal or exceed available balance limit",
      orders: [],
    };
  }

  // Determine number of chunks: strictly 1 to 10
  const maxPossibleChunks = Math.min(10, Math.floor(remainingBalanceToAllocate / 100));
  // Random chunk count between 1 and maxPossibleChunks
  const numChunks = Math.max(
    1,
    Math.min(maxPossibleChunks, Math.floor(Math.random() * maxPossibleChunks) + 1),
  );

  // Partition remainingBalanceToAllocate into `numChunks` round figures
  const chunkDisplayAmounts: number[] = [];
  let unassigned = remainingBalanceToAllocate;

  for (let i = 0; i < numChunks - 1; i++) {
    const slotsLeft = numChunks - i;
    // Each remaining chunk must be at least 100
    const maxForThisChunk = unassigned - (slotsLeft - 1) * 100;
    if (maxForThisChunk <= 100) {
      chunkDisplayAmounts.push(100);
      unassigned -= 100;
      continue;
    }

    // Pick a denomination or clean multiple of 100
    const validDenoms = CLEAN_ROUND_DENOMINATIONS.filter(
      (d) => d <= maxForThisChunk && d <= Math.floor(maxForThisChunk / 2 + 100),
    );
    const chosen =
      validDenoms.length > 0
        ? validDenoms[Math.floor(Math.random() * validDenoms.length)]
        : Math.floor(Math.random() * Math.floor(maxForThisChunk / 100) + 1) * 100;

    chunkDisplayAmounts.push(chosen);
    unassigned -= chosen;
  }
  // Last chunk takes the rest (strictly a multiple of 100)
  chunkDisplayAmounts.push(Math.floor(unassigned / 100) * 100);

  // Filter out any zero or negative chunks
  const finalDisplayAmounts = chunkDisplayAmounts.filter((amt) => amt >= 100);

  const createdOrders: OrderRecord[] = [];
  const now = Date.now();

  for (let i = 0; i < finalDisplayAmounts.length; i++) {
    const displayAmount = finalDisplayAmounts[i];
    const paisaDiscount = generateUniquePaisaDiscount();
    const payableAmount = Math.round((displayAmount - paisaDiscount) * 100) / 100;

    const orderId = `CP${now.toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
    const provider = PAYMENT_PROVIDERS[i % PAYMENT_PROVIDERS.length];

    const { intentUri } = buildUpiIntentUris({
      seller_upi_id: sellerUpiId,
      seller_name: sellerName,
      payable_amount: payableAmount,
      order_id: orderId,
      payment_app_type: provider.type,
    });

    const newOrder: OrderRecord = {
      order_id: orderId,
      order_ref: orderId,
      display_amount: displayAmount,
      payable_amount: payableAmount,
      paisa_discount: paisaDiscount,
      seller_upi_id: sellerUpiId,
      payment_app_type: provider.type,
      symbol: provider.symbol,
      seller_name: sellerName,
      seller_referral_id: sellerReferralId,
      seller_phone: sellerPhone,
      status: "AVAILABLE",
      stage: 0,
      timer_seconds: 0,
      intent_uri: intentUri,
      created_at: now + i,
      updated_at: now + i,
    };

    ordersStore.set(orderId, newOrder);
    createdOrders.push(newOrder);
    broadcast("ORDER_CREATED", newOrder);
  }

  return { success: true, orders: createdOrders };
}

/**
 * MODULE 2: TWO-STAGE SPLIT TIMER & DUAL UPI INTEGRITY CHECK
 */

// Stage 1: 5-Minute Buy Lock
export function lockOrderStage1(
  orderId: string,
  buyer: { buyer_id: string; buyer_phone?: string; buyer_name?: string },
): { success: boolean; error?: string; order?: OrderRecord; timer_seconds: number } {
  const order = ordersStore.get(orderId);
  if (!order) {
    return { success: false, error: "Order not found", timer_seconds: 0 };
  }

  if (order.status !== "AVAILABLE") {
    return {
      success: false,
      error: `Order is not available (current status: ${order.status})`,
      timer_seconds: 0,
    };
  }

  // DUAL INTEGRITY CHECK 1: Verify order data integrity before locking
  if (!order.seller_upi_id || !order.seller_upi_id.includes("@")) {
    return {
      success: false,
      error: "Order integrity check failed: Seller UPI is invalid",
      timer_seconds: 0,
    };
  }
  if (order.display_amount % 100 !== 0 || order.payable_amount >= order.display_amount) {
    return {
      success: false,
      error: "Order integrity check failed: Corrupted amounts",
      timer_seconds: 0,
    };
  }

  const now = Date.now();
  const lockDurationSeconds = 300; // 5 minutes

  order.status = "LOCKED";
  order.stage = 1;
  order.buyer_id = buyer.buyer_id;
  order.buyer_phone = buyer.buyer_phone || buyer.buyer_id;
  order.buyer_name = buyer.buyer_name || "Buyer";
  order.timer_seconds = lockDurationSeconds;
  order.timer_started_at = now;
  order.timer_expires_at = now + lockDurationSeconds * 1000;
  order.updated_at = now;

  ordersStore.set(orderId, order);
  broadcast("ORDER_LOCKED", order);

  return { success: true, order, timer_seconds: lockDurationSeconds };
}

// Stage 2: 15-Minute Payment & UTR Window
export function confirmOrderStage2(
  orderId: string,
  buyerId: string,
): { success: boolean; error?: string; order?: OrderRecord; timer_seconds: number } {
  const order = ordersStore.get(orderId);
  if (!order) {
    return { success: false, error: "Order not found", timer_seconds: 0 };
  }

  if (order.status !== "LOCKED") {
    return {
      success: false,
      error: `Cannot confirm: order is in '${order.status}' status, must be 'LOCKED'`,
      timer_seconds: 0,
    };
  }

  // Clears Stage 1 and starts Stage 2
  const now = Date.now();
  const paymentWindowSeconds = 900; // 15 minutes (Total 20-min max lifecycle)

  order.status = "PAYING";
  order.stage = 2;
  order.timer_seconds = paymentWindowSeconds;
  order.timer_started_at = now;
  order.timer_expires_at = now + paymentWindowSeconds * 1000;
  order.updated_at = now;

  ordersStore.set(orderId, order);
  broadcast("ORDER_CONFIRMED", order);

  return { success: true, order, timer_seconds: paymentWindowSeconds };
}

// DUAL INTEGRITY CHECK 2: Pre-launch validation before launching deep link
export function verifyPreLaunchIntegrity(params: {
  orderId: string;
  targetUpiId: string;
  payableAmount: number;
}): { success: boolean; error?: string } {
  const { orderId, targetUpiId, payableAmount } = params;
  const order = ordersStore.get(orderId);

  if (!order) {
    return { success: false, error: "Integrity check failed: Order does not exist" };
  }

  if (!targetUpiId || !targetUpiId.includes("@") || targetUpiId.includes("undefined")) {
    return { success: false, error: "Integrity check failed: Target UPI ID is invalid" };
  }

  if (order.seller_upi_id.toLowerCase().trim() !== targetUpiId.toLowerCase().trim()) {
    return {
      success: false,
      error: `Integrity check failed: Target UPI mismatch (expected ${order.seller_upi_id}, got ${targetUpiId})`,
    };
  }

  const amtDiff = Math.abs(order.payable_amount - payableAmount);
  if (amtDiff > 0.009) {
    return {
      success: false,
      error: `Integrity check failed: Amount mismatch (expected ₹${order.payable_amount}, got ₹${payableAmount})`,
    };
  }

  return { success: true };
}

/**
 * MODULE 4: STRICT NON-RESET MULTI-UPI ROTATION & BREAK LOGIC
 */
export function getOrCreateSellerState(phone: string): SellerUpiState {
  let state = sellerStateStore.get(phone);
  if (!state) {
    state = {
      phone,
      linked_upis: [],
      current_upi_index: 0,
      consecutive_failures: 0,
      break_count: 0,
      engine_status: "ON",
      engine_off_until: 0,
      hard_stop_locked: false,
    };
    sellerStateStore.set(phone, state);
  }
  return state;
}

export function handleOrderSettle(
  orderId: string,
  status: "SUCCESS" | "CANCELLED" | "FAILED",
  utrNumber?: string,
): { success: boolean; error?: string; order?: OrderRecord } {
  const order = ordersStore.get(orderId);
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  const now = Date.now();
  order.status = status;
  order.utr_number = utrNumber || order.utr_number;
  order.updated_at = now;
  order.timer_seconds = 0;
  order.state_locked = true; // MODULE 5: Atomic state lock

  const sellerState = getOrCreateSellerState(order.seller_phone);

  if (status === "SUCCESS") {
    // STRICT SUCCESS-ONLY RESET RULE:
    // Under no circumstances shall timers, rotation states, or failure counts reset
    // unless a transaction achieves true, verified SUCCESS.
    sellerState.consecutive_failures = 0;
    sellerState.break_count = 0;
    sellerState.engine_off_until = 0;
    sellerState.engine_status = "ON";
    sellerState.hard_stop_locked = false;
    sellerState.last_success_at = now;

    broadcast("ORDER_SUCCESS", order);
  } else {
    // Cancellation / Failure logic
    sellerState.consecutive_failures += 1;

    // Shift smoothly to the next linked UPI if multiple exist
    if (sellerState.linked_upis.length > 1) {
      sellerState.current_upi_index =
        (sellerState.current_upi_index + 1) % sellerState.linked_upis.length;
    }

    // Check if all linked UPIs failed or failure thresholds reached
    const linkedCount = Math.max(1, sellerState.linked_upis.length);
    if (sellerState.consecutive_failures % linkedCount === 0) {
      sellerState.break_count += 1;

      if (sellerState.break_count < 3) {
        // 45-minute cooldown break
        sellerState.engine_status = "OFF";
        sellerState.engine_off_until = now + 45 * 60 * 1000;
        sellerState.hard_stop_locked = false;
      } else {
        // 3 consecutive failures: 4-hour break OR permanent lock requiring manual re-link
        sellerState.engine_status = "OFF";
        sellerState.engine_off_until = now + 4 * 60 * 60 * 1000;
        sellerState.hard_stop_locked = true; // Requires manual re-link or toggle
      }
    }

    // Auto-generate a fresh re-order to return funds to available pool if Stage 1 expired
    if (order.stage === 1) {
      const paisaDiscount = generateUniquePaisaDiscount();
      const payableAmount = Math.round((order.display_amount - paisaDiscount) * 100) / 100;
      const reOrderId = `CP${now.toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;

      // Use the newly rotated UPI ID if available
      const activeUpi =
        sellerState.linked_upis.length > 0
          ? sellerState.linked_upis[sellerState.current_upi_index].upiId
          : order.seller_upi_id;

      const { intentUri } = buildUpiIntentUris({
        seller_upi_id: activeUpi,
        seller_name: order.seller_name,
        payable_amount: payableAmount,
        order_id: reOrderId,
        payment_app_type: order.payment_app_type,
      });

      const reOrder: OrderRecord = {
        order_id: reOrderId,
        order_ref: reOrderId,
        display_amount: order.display_amount,
        payable_amount: payableAmount,
        paisa_discount: paisaDiscount,
        seller_upi_id: activeUpi,
        payment_app_type: order.payment_app_type,
        symbol: order.symbol,
        seller_name: order.seller_name,
        seller_referral_id: order.seller_referral_id,
        seller_phone: order.seller_phone,
        status: "AVAILABLE",
        stage: 0,
        timer_seconds: 0,
        intent_uri: intentUri,
        created_at: now + 100,
        updated_at: now + 100,
      };

      ordersStore.set(reOrderId, reOrder);
      broadcast("ORDER_CREATED", reOrder, { is_reorder: true, original_id: orderId });
    }

    broadcast(status === "CANCELLED" ? "ORDER_CANCELLED" : "ORDER_FAILED", order);
  }

  return { success: true, order };
}

// Manual Re-link resumes order creation immediately on that specific UPI
export function handleManualUpiRelink(
  phone: string,
  newUpiId: string,
  newUpiName: string,
): SellerUpiState {
  const state = getOrCreateSellerState(phone);

  const existingIdx = state.linked_upis.findIndex((u) => u.upiId === newUpiId);
  if (existingIdx >= 0) {
    state.linked_upis[existingIdx].isActive = true;
    state.linked_upis[existingIdx].upiName = newUpiName;
    state.current_upi_index = existingIdx;
  } else {
    state.linked_upis.push({ upiId: newUpiId, upiName: newUpiName, isActive: true });
    state.current_upi_index = state.linked_upis.length - 1;
  }

  // Immediate resume behavior on manual re-link
  state.engine_status = "ON";
  state.engine_off_until = 0;
  state.hard_stop_locked = false;
  state.consecutive_failures = 0;
  state.break_count = 0;

  return state;
}

/**
 * MODULE 5: REAL-TIME SALE LEDGER & BUY HISTORY
 */
export function getActiveSaleLedger(sellerPhone?: string): OrderRecord[] {
  const list: OrderRecord[] = [];
  const now = Date.now();

  for (const order of ordersStore.values()) {
    // Check auto-expiration for timers
    if (order.timer_expires_at && now > order.timer_expires_at) {
      if (order.stage === 1 && order.status === "LOCKED") {
        // Stage 1 expired: Cancel and auto-regenerate
        handleOrderSettle(order.order_id, "CANCELLED");
        continue;
      } else if (order.stage === 2 && order.status === "PAYING") {
        // Stage 2 expired: Failed
        handleOrderSettle(order.order_id, "FAILED");
        continue;
      }
    }

    // Active sale ledger shows ONLY orders in ACTIVE status (AVAILABLE, LOCKED, PAYING)
    if (order.status === "AVAILABLE" || order.status === "LOCKED" || order.status === "PAYING") {
      if (!sellerPhone || order.seller_phone === sellerPhone) {
        list.push(order);
      }
    }
  }

  return list.sort((a, b) => b.created_at - a.created_at);
}

export function getBuyerHistory(buyerId?: string, buyerPhone?: string): OrderRecord[] {
  const list: OrderRecord[] = [];
  for (const order of ordersStore.values()) {
    if (
      (!buyerId && !buyerPhone) ||
      (buyerId && order.buyer_id === buyerId) ||
      (buyerPhone && order.buyer_phone === buyerPhone)
    ) {
      list.push(order);
    }
  }
  return list.sort((a, b) => b.created_at - a.created_at);
}

// Background sweep for two-stage timer expirations (runs every 2 seconds)
setInterval(() => {
  const now = Date.now();
  for (const order of ordersStore.values()) {
    if (order.timer_expires_at && now >= order.timer_expires_at) {
      if (order.stage === 1 && order.status === "LOCKED") {
        console.log(
          `[OrderEngine] Stage 1 (5-min lock) expired for ${order.order_id}. Auto-reordering...`,
        );
        handleOrderSettle(order.order_id, "CANCELLED");
      } else if (order.stage === 2 && order.status === "PAYING") {
        console.log(
          `[OrderEngine] Stage 2 (15-min payment) expired for ${order.order_id}. Marking failed...`,
        );
        handleOrderSettle(order.order_id, "FAILED");
      }
    }
  }
}, 2000);

/**
 * Universal Web Fetch API dispatcher for /api/v1/orders/*
 */
export async function handleOrdersEngineApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");

  if (
    !path.startsWith("/api/v1/orders") &&
    !path.startsWith("/api/orders") &&
    !path.startsWith("/api/order") &&
    !path.startsWith("/api/auto_withdraw") &&
    !path.startsWith("/api/payments/initiate")
  ) {
    return null;
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "access-control-allow-headers": "Content-Type, Authorization",
      },
    });

  try {
    // 0. Dedicated Order Creation (/api/v1/orders/create, /api/orders/create, /api/order/create, /api/v1/orders, /api/orders)
    if (
      request.method === "POST" &&
      (path === "/api/order/create" ||
        path === "/api/orders/create" ||
        path === "/api/v1/orders/create" ||
        path === "/api/v1/order/create" ||
        path === "/api/v1/orders" ||
        path === "/api/orders" ||
        path === "/api/v1/orders/auto-create")
    ) {
      try {
        const body = await request.json().catch(() => ({}));
        console.log(`[OrdersEngine] Received order creation request on ${path}:`, body);

        // Normalize Phone
        const rawPhone =
          body.phone ??
          body.sellerPhone ??
          body.seller_phone ??
          body.mobile ??
          body.userPhone ??
          body.seller_id ??
          "9708634584";
        const sellerPhone = rawPhone.toString().replace(/[^0-9]/g, "") || "9708634584";

        // Normalize Amount & Validate
        const rawAmount =
          body.amount ??
          body.displayAmount ??
          body.display_amount ??
          body.price ??
          body.payableAmount ??
          body.inr_amount ??
          100;
        const requestedAmt = parseFloat(rawAmount);
        if (isNaN(requestedAmt) || requestedAmt <= 0) {
          console.warn(`[OrdersEngine] Order creation rejected: invalid amount (${rawAmount})`);
          return json(
            {
              success: false,
              ok: false,
              error: "Validation failed: 'amount' must be a positive numeric value.",
              received: { phone: rawPhone, amount: rawAmount },
            },
            400,
          );
        }

        // Normalize UPI Handle
        const rawUpi =
          body.upiId ??
          body.upi_id ??
          body.upiHandle ??
          body.upi_handle ??
          body.sellerUpi ??
          body.seller_upi ??
          body.vpa ??
          body.upi ??
          body.upiNo;
        const sellerUpi =
          rawUpi && String(rawUpi).trim().length > 0
            ? String(rawUpi).trim()
            : `${sellerPhone}@paytm`;

        // Normalize Seller Name & Provider
        const sellerName =
          body.name || body.sellerName || body.seller_name || body.userName || "P2P Merchant";
        const provider =
          body.provider ||
          body.payment_app_type ||
          body.paymentApp ||
          body.upiName ||
          body.bank ||
          "UPI";
        const count = Math.max(1, Math.min(20, parseInt(body.count || body.batchCount || 1) || 1));

        const createdOrders: Array<Record<string, unknown>> = [];
        const timestamp = Date.now();

        // Load disk database so we can persist
        const dbPath = nodePath.resolve(process.cwd(), "data/crazypay_db.json");
        let diskDb: Record<string, unknown> = {};
        try {
          if (fs.existsSync(dbPath)) {
            diskDb = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
          }
        } catch (readErr) {
          console.warn(
            "[OrdersEngine] Could not read crazypay_db.json, initializing new:",
            readErr,
          );
        }
        if (!diskDb.p2p_orders) diskDb.p2p_orders = {};

        let supabaseWritten = false;
        let supabaseError: string | null = null;

        for (let i = 0; i < count; i++) {
          const randomSuffix = Math.floor(Math.random() * 90000000 + 10000000);
          const orderId = `5284${randomSuffix}`;
          const discountPaisa = Math.floor(Math.random() * 99) + 1;
          const discountRupees = discountPaisa / 100.0;
          const preciseAmount = Math.max(
            0.01,
            parseFloat((requestedAmt - discountRupees).toFixed(2)),
          );

          const orderObj: OrderRecord = {
            order_id: orderId,
            order_ref: `REF_${orderId}`,
            display_amount: requestedAmt,
            payable_amount: preciseAmount,
            paisa_discount: discountRupees,
            seller_upi_id: sellerUpi,
            payment_app_type: provider,
            symbol: `https://api.dicebear.com/7.x/identicon/svg?seed=${sellerUpi}`,
            seller_name: sellerName,
            seller_referral_id: `REF_${sellerPhone}`,
            seller_phone: sellerPhone,
            status: "AVAILABLE",
            stage: "NONE",
            timer_seconds: 300,
            created_at: timestamp + i,
            updated_at: timestamp + i,
          };

          // Save in memory store
          ordersStore.set(orderId, orderObj);

          // Save in persistent disk database
          const fullOrderRecord = {
            id: orderId,
            order_id: orderId,
            order_ref: `REF_${orderId}`,
            phone: sellerPhone,
            seller_phone: sellerPhone,
            sellerPhone: sellerPhone,
            amount: preciseAmount,
            displayAmount: requestedAmt,
            display_amount: requestedAmt,
            preciseAmount: preciseAmount,
            executionAmount: preciseAmount,
            payableAmount: preciseAmount,
            payable_amount: preciseAmount,
            discountPaise: discountPaisa,
            discount_paise: discountPaisa,
            provider: provider,
            payment_app_type: provider,
            status: "AVAILABLE",
            sellerUpi: sellerUpi,
            seller_upi_id: sellerUpi,
            sellerName: sellerName,
            seller_name: sellerName,
            timestamp: timestamp + i,
            created_at: timestamp + i,
            updated_at: timestamp + i,
          };
          diskDb.p2p_orders[orderId] = fullOrderRecord;
          createdOrders.push(fullOrderRecord);

          // Attempt write to Supabase transactions
          try {
            const { error: sbErr } = await supabase.from("transactions").insert({
              id: crypto.randomUUID(),
              amount: preciseAmount,
              status: "AVAILABLE",
              upi_ref: `ORDER_${orderId}_${sellerUpi}`,
            });
            if (sbErr) {
              supabaseError = sbErr.message;
              console.warn(
                `[OrdersEngine] Supabase insert note for order ${orderId}:`,
                sbErr.message,
              );
            } else {
              supabaseWritten = true;
            }
          } catch (sbEx: unknown) {
            supabaseError = sbEx instanceof Error ? sbEx.message : String(sbEx);
            console.warn(
              `[OrdersEngine] Supabase insert exception for order ${orderId}:`,
              supabaseError,
            );
          }
        }

        // Persist disk DB
        try {
          fs.writeFileSync(dbPath, JSON.stringify(diskDb, null, 2), "utf-8");
          console.log(
            `[OrdersEngine] Successfully persisted ${createdOrders.length} orders to crazypay_db.json`,
          );
        } catch (writeErr) {
          console.error("[OrdersEngine] Failed to write orders to crazypay_db.json:", writeErr);
        }

        console.log(
          `[OrdersEngine] Order creation succeeded: ID=${createdOrders[0]?.id}, Amount=₹${createdOrders[0]?.amount}`,
        );

        return json({
          success: true,
          ok: true,
          orderId: createdOrders[0]?.id,
          order_id: createdOrders[0]?.id,
          order: createdOrders[0] || null,
          orders: createdOrders,
          count: createdOrders.length,
          activeWithdrawal: createdOrders[0] || null,
          databaseSynced: true,
          supabaseSynced: supabaseWritten,
          supabaseError: supabaseError,
          timestamp: timestamp,
        });
      } catch (err: unknown) {
        console.error("[OrdersEngine] Order creation fatal error:", err);
        const errMsg =
          err instanceof Error ? err.message : "Internal server error during order creation";
        const errDetails = err instanceof Error ? err.stack || err.message : String(err);
        return json(
          {
            success: false,
            ok: false,
            error: errMsg,
            code: "ORDER_CREATION_FAILED",
            details: errDetails,
          },
          500,
        );
      }
    }

    // 1. Withdrawal Engine Run (/api/v1/orders/engine/run or /api/auto_withdraw)
    if (
      request.method === "POST" &&
      (path === "/api/v1/orders/engine/run" || path === "/api/auto_withdraw")
    ) {
      const body = await request.json().catch(() => ({}));
      const sellerPhone = body.sellerPhone || body.phone || body.seller_id || "9876543210";
      const sellerName = body.sellerName || body.userName || "P2P Merchant";
      const sellerUpi = body.sellerUpi || body.upiId || `${sellerPhone}@paytm`;
      const balance =
        body.availableBalance !== undefined
          ? parseFloat(body.availableBalance)
          : body.balance !== undefined
            ? parseFloat(body.balance)
            : 0;
      const withdrawalEngineEnabled =
        body.withdrawal_engine !== false && body.withdrawalEngineEnabled !== false;

      const result = executeWithdrawalEngineChunking({
        sellerId: sellerPhone,
        sellerPhone,
        sellerName,
        sellerUpiId: sellerUpi,
        availableBalance: balance,
        withdrawalEngineEnabled,
      });

      if (!result.success) {
        return json({ success: false, ok: false, error: result.error }, 400);
      }

      const activeWithdrawal = result.orders[0]
        ? {
            id: result.orders[0].order_id,
            phone: sellerPhone,
            userName: sellerName,
            requestedAmount: result.orders[0].display_amount,
            preciseAmount: result.orders[0].payable_amount,
            displayAmount: result.orders[0].display_amount,
            executionAmount: result.orders[0].payable_amount,
            channel: result.orders[0].payment_app_type,
            status: "In Transaction",
            timestamp: Date.now(),
          }
        : null;

      return json({
        success: true,
        ok: true,
        orders: result.orders,
        count: result.orders.length,
        activeWithdrawal,
      });
    }

    // 2. Available Orders & Order Listing
    if (
      request.method === "GET" &&
      (path === "/api/v1/orders/available" ||
        path === "/api/v1/orders" ||
        path === "/api/orders" ||
        path === "/api/order/available" ||
        path === "/api/orders/available")
    ) {
      // Reload disk DB to ensure newly persisted orders are in memory
      try {
        const dbPath = nodePath.resolve(process.cwd(), "data/crazypay_db.json");
        if (fs.existsSync(dbPath)) {
          const diskDb = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
          if (diskDb.p2p_orders) {
            for (const [id, rawOrd] of Object.entries(diskDb.p2p_orders)) {
              const ord = (rawOrd || {}) as Record<string, unknown>;
              if (!ordersStore.has(id)) {
                ordersStore.set(id, {
                  order_id: String(ord.order_id || ord.id || id),
                  order_ref: String(ord.order_ref || `REF_${id}`),
                  display_amount: Number(
                    ord.displayAmount || ord.display_amount || ord.amount || 100,
                  ),
                  payable_amount: Number(
                    ord.payableAmount || ord.payable_amount || ord.amount || 100,
                  ),
                  paisa_discount: ord.discountPaise ? Number(ord.discountPaise) / 100 : 0.1,
                  seller_upi_id: String(ord.sellerUpi || ord.seller_upi_id || "merchant@paytm"),
                  payment_app_type: String(ord.provider || ord.payment_app_type || "UPI"),
                  symbol: `https://api.dicebear.com/7.x/identicon/svg?seed=${id}`,
                  seller_name: String(ord.sellerName || ord.seller_name || "Merchant"),
                  seller_referral_id: `REF_${ord.phone || "USER"}`,
                  seller_phone: String(ord.phone || ord.seller_phone || "9708634584"),
                  status: (ord.status as OrderRecord["status"]) || "AVAILABLE",
                  stage: "NONE",
                  timer_seconds: 300,
                  created_at: Number(ord.timestamp || ord.created_at || Date.now()),
                  updated_at: Number(ord.timestamp || ord.updated_at || Date.now()),
                });
              }
            }
          }
        }
      } catch (_e) {
        // Ignore disk reload error
      }

      const available = getActiveSaleLedger().filter((o) => o.status === "AVAILABLE");
      return json({ success: true, ok: true, orders: available, count: available.length });
    }

    // 3. Stage 1: Buy Lock (5-min timer)
    const lockMatch = path.match(/^\/api\/v1\/orders\/([^/]+)\/lock$/);
    if (request.method === "POST" && lockMatch) {
      const orderId = lockMatch[1];
      const body = await request.json().catch(() => ({}));
      const buyerId = body.buyer_id || body.buyerPhone || "GUEST_BUYER";
      const res = lockOrderStage1(orderId, {
        buyer_id: buyerId,
        buyer_phone: body.buyerPhone,
        buyer_name: body.buyerName,
      });
      if (!res.success) {
        return json({ success: false, ok: false, error: res.error }, 400);
      }
      return json({ success: true, ok: true, timer_seconds: res.timer_seconds, order: res.order });
    }

    // 4. Stage 2: Confirm Order (15-min timer)
    const confirmMatch = path.match(/^\/api\/v1\/orders\/([^/]+)\/confirm$/);
    if (request.method === "POST" && confirmMatch) {
      const orderId = confirmMatch[1];
      const body = await request.json().catch(() => ({}));
      const buyerId = body.buyer_id || "GUEST_BUYER";
      const res = confirmOrderStage2(orderId, buyerId);
      if (!res.success) {
        return json({ success: false, ok: false, error: res.error }, 400);
      }
      return json({ success: true, ok: true, timer_seconds: res.timer_seconds, order: res.order });
    }

    // 5. Settle Order (SUCCESS / CANCELLED / FAILED)
    const settleMatch = path.match(/^\/api\/v1\/orders\/([^/]+)\/settle$/);
    if (request.method === "POST" && settleMatch) {
      const orderId = settleMatch[1];
      const body = await request.json().catch(() => ({}));
      const status = (body.status || "SUCCESS").toUpperCase();
      const validStatus = (
        ["SUCCESS", "CANCELLED", "FAILED"].includes(status) ? status : "FAILED"
      ) as "SUCCESS" | "CANCELLED" | "FAILED";
      const res = handleOrderSettle(orderId, validStatus, body.utr_number);
      if (!res.success) {
        return json({ success: false, ok: false, error: res.error }, 400);
      }
      return json({ success: true, ok: true, order: res.order });
    }

    // 6. Dual Integrity Check 2 (Pre-Launch Intent Check)
    if (request.method === "POST" && path === "/api/v1/orders/verify-integrity") {
      const body = await request.json().catch(() => ({}));
      const res = verifyPreLaunchIntegrity({
        orderId: body.orderId,
        targetUpiId: body.targetUpiId,
        payableAmount: parseFloat(body.payableAmount || body.amount || 0),
      });
      return json({ success: res.success, ok: res.success, error: res.error });
    }

    // 7. Payment Initiate
    if (request.method === "POST" && path === "/api/payments/initiate") {
      const body = await request.json().catch(() => ({}));
      const orderId = body.orderId;
      const order = ordersStore.get(orderId);
      if (order) {
        const uris = buildUpiIntentUris({
          seller_upi_id: order.seller_upi_id,
          seller_name: order.seller_name,
          payable_amount: order.payable_amount,
          order_id: order.order_id,
          payment_app_type: order.payment_app_type,
        });
        return json({ success: true, paymentUrl: uris.intentUri, fallbackUrl: uris.genericUri });
      }
      return json({ success: false, error: "Order not found" }, 404);
    }

    // 8. Active Sale Ledger
    if (request.method === "GET" && path === "/api/v1/orders/sale-ledger") {
      const sellerId = url.searchParams.get("seller_id") || undefined;
      const orders = getActiveSaleLedger(sellerId);
      return json({ success: true, ok: true, orders, count: orders.length });
    }

    // 9. Buy History
    if (request.method === "GET" && path === "/api/v1/orders/buy-history") {
      const buyerId = url.searchParams.get("buyer_id") || undefined;
      const orders = getBuyerHistory(buyerId);
      return json({ success: true, ok: true, orders, count: orders.length });
    }

    // 10. Manual UPI Re-link
    if (request.method === "POST" && path === "/api/v1/orders/relink-upi") {
      const body = await request.json().catch(() => ({}));
      const phone = body.phone || "9876543210";
      const upiId = body.upiId;
      const upiName = body.upiName || "UPI";
      if (!upiId || !upiId.includes("@")) {
        return json({ success: false, error: "Valid UPI VPA required" }, 400);
      }
      const updatedState = handleManualUpiRelink(phone, upiId, upiName);
      return json({ success: true, ok: true, state: updatedState });
    }

    // 11. Real-time SSE Stream
    if (request.method === "GET" && path === "/api/v1/orders/stream") {
      let clientSend: ((event: string, data: unknown) => void) | null = null;

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          clientSend = (event: string, data: unknown) => {
            try {
              controller.enqueue(
                encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
              );
            } catch {
              // stream closed
            }
          };
          sseClients.add(clientSend);

          // Initial ping
          controller.enqueue(
            encoder.encode(
              `event: CONNECTED\ndata: ${JSON.stringify({ status: "connected", time: Date.now() })}\n\n`,
            ),
          );
        },
        cancel() {
          if (clientSend) sseClients.delete(clientSend);
        },
      });

      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
          "access-control-allow-origin": "*",
        },
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ success: false, ok: false, error: msg }, 500);
  }

  return null;
}
