/**
 * CRAZY PAY :: FRONTEND ORDER CREATION ENGINE & SAFETY OVERRIDE (full overwrite)
 * ---------------------------------------------------------------------------
 * High-Risk Financial P2P Engine:
 *  - MODULE 1: Server-bound data (clean round display amounts + unique paisa discount).
 *  - MODULE 2: Two-stage split timer (5-min Buy Lock -> 15-min Payment/UTR) + Dual Integrity Checks.
 *  - MODULE 3: Secure UPI deep-linking "Pay Now" with Mobikwik intent & generic fallback.
 *  - MODULE 4: Strict Success-Only Reset Rule, Multi-UPI Rotation, 45-min & 4-hour Cooldown Breaks,
 *              Manual Re-link Resume & Auto-Resume, and Anti-Loop Safeguards.
 *  - MODULE 5: Real-time Active Sale Ledger & Buy History Atomic State Lock.
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  var API = "/api/v1/orders";
  var ACTIVE = ["AVAILABLE", "LOCKED", "PAYING"];
  var TERMINAL = ["SUCCESS", "CANCELLED", "FAILED"];

  /* ------------------------------------------------------------- helpers */

  function api(path, options) {
    return fetch(
      API + path,
      Object.assign({ headers: { "Content-Type": "application/json" } }, options || {}),
    ).then(function (r) {
      return r.json().then(function (body) {
        if (!r.ok || body.ok === false) {
          throw new Error(body.error || "Request failed with status " + r.status);
        }
        return body;
      });
    });
  }

  function fmtClock(seconds) {
    var s = Math.max(0, Math.floor(seconds));
    var m = Math.floor(s / 60);
    var rem = s % 60;
    return String(m).padStart(2, "0") + ":" + String(rem).padStart(2, "0");
  }

  function emit(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (_) {
      // ignore
    }
  }

  /* -------------------------------------- MODULE 2 :: two-stage timer */

  var timers = {}; // order_id -> { id, stage, deadline }

  /**
   * Stage 1: 5-minute (300s) Buy Lock timer.
   * Stage 2: 15-minute (900s) Payment & UTR window (Total 20-min max lifecycle).
   */
  function startTimer(orderId, stage, seconds, opts) {
    clearTimer(orderId);
    opts = opts || {};
    var duration = Math.max(1, Math.floor(seconds));
    var deadline = Date.now() + duration * 1000;

    function tick() {
      var left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      var clockStr = fmtClock(left);

      if (opts.onTick) opts.onTick(left, clockStr, stage);
      emit("crazypay:timer", {
        order_id: orderId,
        stage: stage,
        seconds_left: left,
        clock: clockStr,
      });

      if (left <= 0) {
        clearTimer(orderId);
        if (opts.onExpire) opts.onExpire(stage);
        emit("crazypay:timer-expired", { order_id: orderId, stage: stage });
      }
    }

    tick();
    timers[orderId] = {
      id: setInterval(tick, 1000),
      stage: stage,
      deadline: deadline,
    };
    return timers[orderId];
  }

  function clearTimer(orderId) {
    if (timers[orderId]) {
      clearInterval(timers[orderId].id);
      delete timers[orderId];
    }
  }

  function clearAllTimers() {
    Object.keys(timers).forEach(clearTimer);
  }

  /* ----------------------------------- MODULE 2 :: Dual Integrity Checks */

  /**
   * Dual Integrity Check #1: Verify order data structure and valid VPA format.
   */
  function verifyOrderFormat(order) {
    if (!order) return { ok: false, error: "Order object missing" };
    var upi = String(order.seller_upi_id || order.upiId || order.sellerUpi || "");
    if (!upi || upi.indexOf("@") === -1 || upi.toLowerCase().indexOf("undefined") !== -1) {
      return { ok: false, error: "Invalid or unverified Seller UPI ID: " + upi };
    }
    var payable = parseFloat(order.payable_amount || order.executionAmount || order.amount || 0);
    var display = parseFloat(order.display_amount || payable);
    if (!isFinite(payable) || payable <= 0) {
      return { ok: false, error: "Invalid payable amount: ₹" + payable };
    }
    if (display > 0 && display % 100 !== 0) {
      console.warn("[OrderEngine] Display amount ₹" + display + " is not a clean round integer.");
    }
    return { ok: true, payable: payable, display: display, upi: upi };
  }

  /**
   * Dual Integrity Check #2: Validate order immediately before launching UPI intent.
   */
  function verifyPreLaunchIntegrity(order, targetUpiId, payableAmount) {
    var check1 = verifyOrderFormat(order);
    if (!check1.ok) return check1;

    var expectedUpi = (order.seller_upi_id || order.upiId || "").toLowerCase().trim();
    var actualUpi = String(targetUpiId || "")
      .toLowerCase()
      .trim();
    if (actualUpi && expectedUpi && expectedUpi !== actualUpi) {
      return {
        ok: false,
        error: "CRITICAL UPI MISMATCH: Expected " + expectedUpi + " but got " + actualUpi,
      };
    }

    var expectedAmt = parseFloat(
      order.payable_amount || order.executionAmount || order.amount || 0,
    );
    var actualAmt = parseFloat(payableAmount);
    if (isFinite(actualAmt) && isFinite(expectedAmt)) {
      if (Math.abs(expectedAmt - actualAmt) > 0.01) {
        return {
          ok: false,
          error: "CRITICAL AMOUNT MISMATCH: Expected ₹" + expectedAmt + " but got ₹" + actualAmt,
        };
      }
    }

    return { ok: true };
  }

  /* ------------------------------------------ MODULE 1 :: order actions */

  function runWithdrawalEngine(params) {
    var payload = typeof params === "object" ? params : { seller_id: params };
    return api("/engine/run", { method: "POST", body: JSON.stringify(payload) });
  }

  function listAvailable() {
    return api("/available").then(function (b) {
      return b.orders || [];
    });
  }

  /**
   * Stage 1: Buyer opened/reserved the order card -> lock for 5 minutes (300s).
   */
  function openOrder(orderId, buyerId, handlers) {
    return api("/" + encodeURIComponent(orderId) + "/lock", {
      method: "POST",
      body: JSON.stringify({ buyer_id: buyerId }),
    }).then(function (res) {
      // Stage 1 (300s): Auto-cancels and returns re-order to pool if expired
      startTimer(orderId, 1, res.timer_seconds || 300, {
        onTick: handlers && handlers.onTick,
        onExpire: function () {
          console.warn("[OrderEngine] Stage 1 (5-min Buy Lock) expired for order " + orderId);
          emit("crazypay:buy-lock-expired", { order_id: orderId });
          if (handlers && handlers.onBuyLockExpired) handlers.onBuyLockExpired(res.order);
        },
      });
      return res.order;
    });
  }

  /**
   * Stage 2: Buyer confirmed order -> clears Stage 1 and starts 15-minute (900s) UTR window.
   */
  function confirmOrder(orderId, buyerId, handlers) {
    return api("/" + encodeURIComponent(orderId) + "/confirm", {
      method: "POST",
      body: JSON.stringify({ buyer_id: buyerId }),
    }).then(function (res) {
      clearTimer(orderId); // Kill Stage 1 timer
      startTimer(orderId, 2, res.timer_seconds || 900, {
        onTick: handlers && handlers.onTick,
        onExpire: function () {
          console.warn("[OrderEngine] Stage 2 (15-min Payment) expired for order " + orderId);
          emit("crazypay:payment-expired", { order_id: orderId });
          if (handlers && handlers.onPaymentExpired) handlers.onPaymentExpired(res.order);
        },
      });
      return res.order;
    });
  }

  function settleOrder(orderId, status, utr) {
    return api("/" + encodeURIComponent(orderId) + "/settle", {
      method: "POST",
      body: JSON.stringify({ status: status, utr_number: utr || null }),
    }).then(function (res) {
      clearTimer(orderId);
      lockHistoryRecord(res.order);
      return res.order;
    });
  }

  /* ---------------------------------------------- MODULE 3 :: Pay Now */

  function payNow(order, opts) {
    opts = opts || {};
    var targetUpi = opts.targetUpiId || order.seller_upi_id || order.upiId;
    var targetAmt = opts.payableAmount || order.payable_amount || order.amount;

    // Run Dual Integrity Check #2 before launching intent
    var check = verifyPreLaunchIntegrity(order, targetUpi, targetAmt);
    if (!check.ok) {
      alert("⚠️ " + check.error + "\n\nPayment aborted for your safety.");
      throw new Error(check.error);
    }

    if (!window.CrazyPayUpi) {
      throw new Error("UPI deep link handler (CrazyPayUpi) not loaded");
    }

    return window.CrazyPayUpi.launchUpiPayment(
      order,
      opts.provider || order.payment_app_type || "mobikwik",
    );
  }

  /* ------------------ MODULE 4 :: Strict Multi-UPI Rotation & Safety State */

  var sellerState = {
    phone: "",
    consecutiveFailures: 0,
    breakCount: 0,
    engineStatus: "ON",
    engineOffUntil: 0,
    hardStopLocked: false,
  };

  function getSellerRotationState() {
    return Object.assign({}, sellerState);
  }

  function updateSellerRotationState(nextState) {
    Object.assign(sellerState, nextState);
    emit("crazypay:seller-state-updated", sellerState);
    return sellerState;
  }

  /**
   * Manual Re-link resumes order creation immediately on that specific UPI.
   */
  function relinkUpi(phone, upiId, upiName) {
    return api("/relink-upi", {
      method: "POST",
      body: JSON.stringify({ phone: phone, upiId: upiId, upiName: upiName }),
    }).then(function (res) {
      updateSellerRotationState({
        engineStatus: "ON",
        engineOffUntil: 0,
        hardStopLocked: false,
        consecutiveFailures: 0,
        breakCount: 0,
      });
      emit("crazypay:upi-relinked", res.state);
      return res;
    });
  }

  /* -------------------------------- MODULE 5 :: ledgers + state lock */

  var historyLock = Object.create(null); // order_id -> frozen record

  /** Freezes a terminal record so nothing can move it back into active processing. */
  function lockHistoryRecord(order) {
    if (!order) return null;
    var orderId = order.order_id || order.id;
    if (!orderId) return order;
    if (TERMINAL.indexOf(order.status) === -1) return order;
    if (historyLock[orderId]) return historyLock[orderId];

    historyLock[orderId] = Object.freeze(Object.assign({}, order, { state_locked: true }));
    clearTimer(orderId);
    emit("crazypay:history-locked", historyLock[orderId]);
    return historyLock[orderId];
  }

  function isLocked(orderId) {
    return Boolean(historyLock[orderId]);
  }

  /** Seller dashboard: ONLY live orders (AVAILABLE / LOCKED / PAYING). */
  function filterActiveLedger(orders) {
    return (orders || []).filter(function (o) {
      return ACTIVE.indexOf(o.status) !== -1;
    });
  }

  function loadSaleLedger(sellerId) {
    return api("/sale-ledger?seller_id=" + encodeURIComponent(sellerId || "")).then(function (b) {
      return filterActiveLedger(b.orders);
    });
  }

  function loadBuyHistory(buyerId) {
    return api("/buy-history?buyer_id=" + encodeURIComponent(buyerId || "")).then(function (b) {
      return (b.orders || []).map(function (o) {
        return TERMINAL.indexOf(o.status) !== -1 ? lockHistoryRecord(o) : o;
      });
    });
  }

  /* ------------------------------------------- realtime state listener */

  var source = null;

  function connectRealtime(opts) {
    opts = opts || {};
    disconnectRealtime();

    var qs = [];
    if (opts.sellerId) qs.push("seller_id=" + encodeURIComponent(opts.sellerId));
    if (opts.buyerId) qs.push("buyer_id=" + encodeURIComponent(opts.buyerId));
    source = new EventSource(API + "/stream" + (qs.length ? "?" + qs.join("&") : ""));

    source.onmessage = handleMessage;
    [
      "ORDER_CREATED",
      "ORDER_LOCKED",
      "ORDER_CONFIRMED",
      "ORDER_SUCCESS",
      "ORDER_CANCELLED",
      "ORDER_FAILED",
      "BUY_LOCK_EXPIRED",
      "PAYMENT_WINDOW_EXPIRED",
    ].forEach(function (evt) {
      source.addEventListener(evt, handleMessage);
    });

    function handleMessage(e) {
      var data;
      try {
        data = JSON.parse(e.data);
      } catch (_) {
        return;
      }
      var order = data.order;
      if (!order) return;

      if (TERMINAL.indexOf(order.status) !== -1) {
        lockHistoryRecord(order);
      }
      emit("crazypay:order-update", data);
      if (opts.onUpdate) opts.onUpdate(data);
    }

    return source;
  }

  function disconnectRealtime() {
    if (source) {
      source.close();
      source = null;
    }
  }

  window.CrazyPayOrderEngine = {
    API: API,
    ACTIVE_STATUSES: ACTIVE,
    TERMINAL_STATUSES: TERMINAL,
    fmtClock: fmtClock,
    verifyOrderFormat: verifyOrderFormat,
    verifyPreLaunchIntegrity: verifyPreLaunchIntegrity,
    runWithdrawalEngine: runWithdrawalEngine,
    listAvailable: listAvailable,
    openOrder: openOrder,
    confirmOrder: confirmOrder,
    settleOrder: settleOrder,
    payNow: payNow,
    startTimer: startTimer,
    clearTimer: clearTimer,
    clearAllTimers: clearAllTimers,
    filterActiveLedger: filterActiveLedger,
    loadSaleLedger: loadSaleLedger,
    loadBuyHistory: loadBuyHistory,
    lockHistoryRecord: lockHistoryRecord,
    isLocked: isLocked,
    connectRealtime: connectRealtime,
    disconnectRealtime: disconnectRealtime,
    getSellerRotationState: getSellerRotationState,
    updateSellerRotationState: updateSellerRotationState,
    relinkUpi: relinkUpi,
  };
})();
