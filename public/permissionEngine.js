/**
 * CrazyPay P2P Engine — Compact Notification Consent & Mandatory Terms Agreement
 * Full implementation with:
 *  - Compact Centered Modal (#0f172a, #10b981 accents, Bell Icon)
 *  - Heading: "Enable Real-Time Payment Alerts & Ledger Verification"
 *  - Subtext: "CrazyPay requires background alert authorization to verify incoming UTR references instantly."
 *  - Checkbox: [ ] I agree to the Terms & Conditions with (Open T&C) modal
 *  - T&C Modal: Explains continuous alert necessity, limitation of liability, and official Telegram support guidance
 *  - Interactive Lock: "Allow Alerts" disabled until checkbox is checked
 *  - Immediate native Notification.requestPermission() invocation, localStorage + IndexedDB persistence
 *  - Strict feature interceptor for Link New UPI, Buy, Sell, and Withdraw
 */

(function (window, document) {
  "use strict";

  const STORAGE_KEY = "crazypay_notification_granted";
  const COMPAT_KEY = "crazypay_persistent_auth";
  const DB_NAME = "CrazyPaySecurityDB";
  const STORE_NAME = "permission_vault";

  let pendingActionCallback = null;
  let dbInstance = null;

  // 1. IndexedDB Helper for permanent persistence
  function getDB() {
    return new Promise((resolve) => {
      if (dbInstance) return resolve(dbInstance);
      if (!("indexedDB" in window)) return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = function (e) {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      request.onerror = function () {
        resolve(null);
      };
    });
  }

  // 2. Persist authorization across storage tiers
  async function savePersistentConsent() {
    const timestamp = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, "true");
      localStorage.setItem(COMPAT_KEY, "true");
      localStorage.setItem("crazypay_auth_timestamp", timestamp.toString());
    } catch (_e) {}

    try {
      const db = await getDB();
      if (db) {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put({
          id: "p2p_engine_auth",
          status: "PERMANENT_ACTIVE",
          timestamp: timestamp,
          notificationPermission: window.Notification ? Notification.permission : "unknown",
        });
      }
    } catch (_e) {}

    if (navigator.storage && navigator.storage.persist) {
      try {
        await navigator.storage.persist();
      } catch (_e) {}
    }

    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "PERMISSIONS_AUTHORIZED",
        timestamp: timestamp,
      });
    }
  }

  // 3. Permission status evaluator
  function isPermissionGranted() {
    const local =
      localStorage.getItem(STORAGE_KEY) === "true" ||
      localStorage.getItem(COMPAT_KEY) === "true" ||
      localStorage.getItem("crazypay_perm_allowed") === "true";
    const native = !("Notification" in window) || Notification.permission === "granted";
    return local && native;
  }

  // 4. Inject Styles and Modals into DOM
  function injectConsentElements() {
    if (document.getElementById("cp-consent-style")) return;

    // Styles
    const styleEl = document.createElement("style");
    styleEl.id = "cp-consent-style";
    styleEl.textContent = `
      .cp-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 999990;
        background-color: rgba(3, 7, 18, 0.75);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .cp-modal-backdrop.cp-active {
        opacity: 1;
        pointer-events: auto;
      }
      .cp-consent-card {
        width: 100%;
        max-width: 380px;
        background: #0f172a;
        border: 1px solid #1e293b;
        border-radius: 18px;
        padding: 1.5rem;
        box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(16, 185, 129, 0.12);
        color: #f1f5f9;
        transform: scale(0.95);
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .cp-modal-backdrop.cp-active .cp-consent-card {
        transform: scale(1);
      }
      .cp-consent-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      .cp-bell-icon-wrapper {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        background: rgba(16, 185, 129, 0.12);
        border: 1px solid rgba(16, 185, 129, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #10b981;
        flex-shrink: 0;
      }
      .cp-brand-label {
        font-size: 0.6875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #10b981;
        margin-bottom: 2px;
      }
      .cp-consent-title {
        font-size: 1rem;
        font-weight: 700;
        line-height: 1.35;
        color: #ffffff;
        margin: 0;
      }
      .cp-consent-subtext {
        font-size: 0.8125rem;
        line-height: 1.5;
        color: #94a3b8;
        margin: 0 0 1.125rem 0;
      }
      .cp-terms-agreement-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem;
        background: #090e1a;
        border: 1px solid #1e293b;
        border-radius: 10px;
        margin-bottom: 1.25rem;
      }
      .cp-terms-agreement-row input[type="checkbox"] {
        appearance: none;
        -webkit-appearance: none;
        width: 17px;
        height: 17px;
        border: 1.5px solid #475569;
        border-radius: 4px;
        background: transparent;
        cursor: pointer;
        position: relative;
        outline: none;
        flex-shrink: 0;
        transition: all 0.15s ease;
      }
      .cp-terms-agreement-row input[type="checkbox"]:checked {
        background: #10b981;
        border-color: #10b981;
      }
      .cp-terms-agreement-row input[type="checkbox"]:checked::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 5px;
        width: 4px;
        height: 8px;
        border: solid #04100c;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
      }
      .cp-terms-text {
        font-size: 0.75rem;
        color: #cbd5e1;
        user-select: none;
        cursor: pointer;
      }
      .cp-terms-link {
        color: #38bdf8;
        text-decoration: underline;
        font-weight: 600;
        cursor: pointer;
        background: none;
        border: none;
        padding: 0;
        font-size: 0.75rem;
        display: inline;
      }
      .cp-terms-link:hover {
        color: #7dd3fc;
      }
      .cp-consent-actions {
        display: flex;
        gap: 0.625rem;
      }
      .cp-btn-confirm {
        flex: 1;
        height: 42px;
        background: #10b981;
        color: #04100c;
        border: none;
        border-radius: 10px;
        font-size: 0.8125rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .cp-btn-confirm:hover:not(:disabled) {
        background: #34d399;
      }
      .cp-btn-confirm:disabled {
        background: #1e293b;
        color: #475569;
        cursor: not-allowed;
      }
      .cp-btn-dismiss {
        height: 42px;
        padding: 0 1rem;
        background: transparent;
        color: #94a3b8;
        border: 1px solid #1e293b;
        border-radius: 10px;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .cp-btn-dismiss:hover {
        background: #1e293b;
        color: #f1f5f9;
      }
      #cp-tc-overlay {
        z-index: 999995;
      }
      .cp-tc-card {
        width: 100%;
        max-width: 440px;
        max-height: 80vh;
        background: #0b1120;
        border: 1px solid #1e293b;
        border-radius: 18px;
        padding: 1.5rem;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
        color: #e2e8f0;
        display: flex;
        flex-direction: column;
      }
      .cp-tc-title {
        font-size: 1.125rem;
        font-weight: 700;
        margin: 0 0 0.875rem 0;
        color: #ffffff;
      }
      .cp-tc-content {
        overflow-y: auto;
        font-size: 0.8125rem;
        line-height: 1.6;
        color: #94a3b8;
        padding-right: 0.5rem;
        margin-bottom: 1.25rem;
      }
      .cp-tc-content h4 {
        font-size: 0.875rem;
        font-weight: 700;
        color: #f1f5f9;
        margin: 0.75rem 0 0.25rem 0;
      }
      .cp-tc-close-btn {
        width: 100%;
        height: 40px;
        background: #1e293b;
        color: #f1f5f9;
        border: 1px solid #334155;
        border-radius: 10px;
        font-size: 0.8125rem;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .cp-tc-close-btn:hover {
        background: #334155;
      }
    `;
    document.head.appendChild(styleEl);

    // Consent Modal HTML
    const consentWrapper = document.createElement("div");
    consentWrapper.id = "cp-consent-overlay";
    consentWrapper.className = "cp-modal-backdrop";
    consentWrapper.setAttribute("role", "dialog");
    consentWrapper.setAttribute("aria-modal", "true");
    consentWrapper.setAttribute("aria-labelledby", "cp-dialog-title");
    consentWrapper.innerHTML = `
      <div class="cp-consent-card">
        <div class="cp-consent-header">
          <div class="cp-bell-icon-wrapper">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <div>
            <div class="cp-brand-label">CrazyPay P2P Engine</div>
            <h3 id="cp-dialog-title" class="cp-consent-title">Enable Real-Time Payment Alerts & Ledger Verification</h3>
          </div>
        </div>
        <p class="cp-consent-subtext">
          CrazyPay requires background alert authorization to verify incoming UTR references instantly.
        </p>
        <div class="cp-terms-agreement-row">
          <input type="checkbox" id="cp-terms-checkbox" />
          <label for="cp-terms-checkbox" class="cp-terms-text">
            I agree to the Terms & Conditions
          </label>
          <button type="button" id="cp-open-tc-btn" class="cp-terms-link">(Open T&C)</button>
        </div>
        <div class="cp-consent-actions">
          <button type="button" id="cp-btn-dismiss" class="cp-btn-dismiss">Cancel</button>
          <button type="button" id="cp-btn-confirm" class="cp-btn-confirm" disabled>Allow Alerts</button>
        </div>
      </div>
    `;
    document.body.appendChild(consentWrapper);

    // Terms & Conditions Modal HTML
    const tcWrapper = document.createElement("div");
    tcWrapper.id = "cp-tc-overlay";
    tcWrapper.className = "cp-modal-backdrop";
    tcWrapper.setAttribute("role", "dialog");
    tcWrapper.setAttribute("aria-modal", "true");
    tcWrapper.setAttribute("aria-labelledby", "cp-tc-title");
    tcWrapper.innerHTML = `
      <div class="cp-tc-card">
        <h3 id="cp-tc-title" class="cp-tc-title">Terms & Conditions of Service</h3>
        <div class="cp-tc-content">
          <h4>1. Instant Ledger Verification Protocol</h4>
          <p>
            CrazyPay utilizes real-time browser alerts and background synchronization to confirm UTR (Unique Transaction Reference) validation instantly. Continuous notification authorization allows immediate reconciliation of orders and automated escrow release.
          </p>
          <h4>2. Limitation of Platform Liability</h4>
          <p>
            CrazyPay bears no legal or financial liability for delays, failed transmissions, or stuck balances resulting from downtime on third-party banking servers, NPCI/IMPS network interruptions, or incorrect UTR reference strings submitted by users.
          </p>
          <h4>3. Transaction Dispute & Support Guidance</h4>
          <p>
            In the event of an unverified payment or stuck funds due to banking gateway latency, users must submit their transaction hash, bank receipt, and registered account details directly to the official CrazyPay Telegram support handle for manual administrative investigation.
          </p>
        </div>
        <button type="button" id="cp-btn-close-tc" class="cp-tc-close-btn">Close Terms</button>
      </div>
    `;
    document.body.appendChild(tcWrapper);

    // Event Listeners for Modals
    const termsCheckbox = document.getElementById("cp-terms-checkbox");
    const openTcBtn = document.getElementById("cp-open-tc-btn");
    const closeTcBtn = document.getElementById("cp-btn-close-tc");
    const btnConfirm = document.getElementById("cp-btn-confirm");
    const btnDismiss = document.getElementById("cp-btn-dismiss");

    termsCheckbox.addEventListener("change", function () {
      btnConfirm.disabled = !this.checked;
    });

    openTcBtn.addEventListener("click", function () {
      tcWrapper.classList.add("cp-active");
    });

    closeTcBtn.addEventListener("click", function () {
      tcWrapper.classList.remove("cp-active");
    });

    btnDismiss.addEventListener("click", function () {
      closeConsentModal();
    });

    btnConfirm.addEventListener("click", async function () {
      if (!termsCheckbox.checked) return;

      // 1. Check if browser previously blocked permission
      if ("Notification" in window && Notification.permission === "denied") {
        alert("आपने पहले परमिशन ब्लॉक कर रखी है! कृपया ब्राउज़र/क्रोम की साइट सेटिंग्स में जाकर Notifications को Allow करें।");
        return;
      }

      btnConfirm.disabled = true;
      btnConfirm.textContent = "Authorizing...";

      // 2. Immediate native permission prompt
      try {
        if ("Notification" in window) {
          const permissionResult = await Notification.requestPermission();
          if (permissionResult === "granted") {
            await savePersistentConsent();
            const callback = pendingActionCallback;
            closeConsentModal();
            if (typeof callback === "function") {
              callback();
            }
            return;
          } else {
            alert("परमिशन देना आवश्यक है ताकि लेजर स्कैन व अलर्ट्स चालू हो सकें।");
          }
        } else {
          await savePersistentConsent();
          const callback = pendingActionCallback;
          closeConsentModal();
          if (typeof callback === "function") {
            callback();
          }
          return;
        }
      } catch (err) {
        console.error("Permission error:", err);
      } finally {
        btnConfirm.disabled = !termsCheckbox.checked;
        btnConfirm.textContent = "Allow Alerts";
      }

      closeConsentModal();
    });
  }

  function openConsentModal(callback) {
    injectConsentElements();
    pendingActionCallback = callback;
    const overlay = document.getElementById("cp-consent-overlay");
    const checkbox = document.getElementById("cp-terms-checkbox");
    const confirmBtn = document.getElementById("cp-btn-confirm");
    if (checkbox) checkbox.checked = false;
    if (confirmBtn) confirmBtn.disabled = true;
    if (overlay) overlay.classList.add("cp-active");
  }

  function closeConsentModal() {
    const overlay = document.getElementById("cp-consent-overlay");
    if (overlay) overlay.classList.remove("cp-active");
    pendingActionCallback = null;
  }

  // 5. Interceptor for protected actions (UPI, Buy, Sell, Withdraw)
  function interceptAction(callback) {
    if (isPermissionGranted()) {
      if (typeof callback === "function") callback();
      return true;
    }
    openConsentModal(callback);
    return false;
  }

  function initInterceptors() {
    injectConsentElements();

    document.addEventListener(
      "click",
      function (event) {
        if (isPermissionGranted()) return;

        const target = event.target.closest(
          '#btn-link-upi, .btn-link-upi, [data-action="link-upi"], ' +
          '#btn-buy, .btn-buy-action, [data-action="buy"], ' +
          '#btn-sell, .btn-sell-action, [data-action="sell"], ' +
          '#btn-withdraw, .btn-withdraw-action, [data-action="withdraw"], ' +
          '#withdrawal-engine-card, [onclick*="openLinkUpiModal"], [onclick*="openWithdrawModal"]'
        );

        if (target) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          const originalHandler = target.onclick;
          const resume = function () {
            if (typeof originalHandler === "function") {
              originalHandler.call(target, event);
            } else {
              target.click();
            }
          };

          openConsentModal(resume);
        }
      },
      true
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initInterceptors);
  } else {
    initInterceptors();
  }

  // Global window exposure
  window.CrazyPayNotificationConsent = {
    isPermissionGranted,
    openConsentModal,
    closeConsentModal,
    interceptAction,
  };
  window.CrazyPayPermissionEngine = {
    isAuthorized: isPermissionGranted,
    requireAuthorization: (context, cb) => interceptAction(cb),
    renderModal: openConsentModal,
    hideModal: closeConsentModal,
    savePersistentState: savePersistentConsent,
    initCrazyPayTriggers: initInterceptors,
  };
})(window, document);
