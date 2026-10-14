/**
 * CRAZYPAY CUSTOM P2P ENGINE - MASTER API CONTROLLER
 * ============================================================================
 * Handles Auth, Provider Connections, Single-Binding Accounts, Marketplace,
 * State Machine Transitions, and 100% Automated Background Verification.
 * ============================================================================
 */

import { authService } from "../auth/auth-service";
import { providerRegistry } from "../providers/official-provider-registry";
import { mobikwikProviderAdapter } from "../providers/mobikwik-provider";
import { dynamicProviderEngine } from "../providers/dynamic-provider-engine";
import { singleBindingManager } from "../engine/binding-manager";
import { matchingEngine } from "../engine/matching-engine";
import { TradeStateMachine } from "../engine/state-machine";
import { AutomatedVerificationPipeline } from "../engine/verification-pipeline";
import { backgroundQueue } from "../workers/queue";

export async function handleP2pEngineApi(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method;

  const jsonResponse = (data: unknown, status = 200) => {
    let payload = data;
    if (typeof data === "object" && data !== null) {
      const obj = data as Record<string, unknown>;
      if (status >= 400 && !obj.status) {
        payload = {
          status: "error",
          message: obj.error || obj.message || "An error occurred",
          error: obj.error || obj.message || "An error occurred",
          ...obj,
        };
      } else if (status < 400 && !obj.status) {
        payload = { status: "success", ...obj };
      }
    }
    return new Response(JSON.stringify(payload), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    });
  };

  try {
    // ------------------------------------------------------------------------
    // 1. AUTHENTICATION ENDPOINTS
    // ------------------------------------------------------------------------
    if (
      (path === "/api/v1/auth/request-otp" || path === "/api/v1/auth/send-otp") &&
      method === "POST"
    ) {
      const body = await req.json().catch(() => ({}));
      const { mobile, phone } = body;
      const res = await authService.requestOtp(mobile || phone || "");
      return jsonResponse(res);
    }

    if (path === "/api/v1/auth/verify-otp" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { mobile, phone, otp, code } = body;
      const res = await authService.verifyOtpAndLogin(mobile || phone || "", otp || code || "");
      return jsonResponse({
        status: "success",
        success: true,
        user: res.user,
        session: {
          accessToken: res.session.accessToken,
          refreshToken: res.session.refreshToken,
          expiresAt: res.session.expiresAt,
        },
      });
    }

    if (path === "/api/v1/auth/session" && method === "GET") {
      const authHeader = req.headers.get("authorization") || "";
      const auth = await authService.authenticateToken(authHeader);
      if (!auth) {
        // Return default demo merchant for immediate preview testing
        const defaultUser = authService.getUser("usr_demo_seller_1");
        return jsonResponse({
          status: "success",
          authenticated: true,
          user: defaultUser,
          isDemo: true,
        });
      }
      return jsonResponse({ status: "success", authenticated: true, user: auth.user });
    }

    if (path === "/api/v1/auth/logout" && method === "POST") {
      const authHeader = req.headers.get("authorization") || "";
      await authService.logout(authHeader);
      return jsonResponse({ status: "success", success: true, message: "Logged out successfully" });
    }

    // ------------------------------------------------------------------------
    // 2. PAYMENT PROVIDER DISCOVERY & OAUTH
    // ------------------------------------------------------------------------
    if (path === "/api/v1/providers/list" && method === "GET") {
      const allProfiles = dynamicProviderEngine.listAllProviders();
      const providers = allProfiles.map((p) => ({
        id: p.id,
        name: p.name,
        displayName: p.displayName,
        category: p.category,
        handles: p.handles,
        bankName: p.bankName,
        logo: p.logoUrl,
        supportedCurrencies: ["INR"],
        requiresOAuth: false,
        apiVersion: "v4-live",
        isAvailable: true,
        sla: p.slaText || "⚡ 10-20s OTP",
        capabilities: ["READ_ACCOUNTS", "READ_IDENTIFIERS", "READ_TRANSACTIONS", "READ_STATUS"],
      }));
      return jsonResponse({ status: "success", success: true, count: providers.length, providers });
    }

    if (path === "/api/v1/providers/oauth/authorize" && method === "GET") {
      const providerId = url.searchParams.get("provider_id") || "phonepe";
      const adapter = providerRegistry.get(providerId);
      if (!adapter) {
        return jsonResponse(
          { status: "error", message: "Provider not supported", error: "Provider not supported" },
          400,
        );
      }
      const authUrl = await adapter.getAuthorizationUrl("state_p2p_123", "/oauth/callback");
      return jsonResponse({ status: "success", success: true, authUrl });
    }

    // 2B. ROCKET-SPEED DYNAMIC MULTI-PROVIDER ASYNC OTP TRIGGER (PhonePe, Paytm, GPay, Freecharge, Super Money, MobiKwik, etc.)
    if (
      (path === "/api/v1/providers/auth/initiate" ||
        path === "/api/v1/providers/otp/send" ||
        path === "/api/v1/providers/mobikwik/initiate") &&
      method === "POST"
    ) {
      const body = await req.json().catch(() => ({}));
      const { mobile, phone, name, provider, providerId } = body;
      const targetPhone = (mobile || phone || "").toString();
      const targetProvider = (provider || providerId || "PhonePe").toString();

      try {
        const result = await dynamicProviderEngine.initiateDynamicOtp(
          targetPhone,
          name || "CrazyPay Verified Trader",
          targetProvider,
        );

        return jsonResponse({
          status: "success",
          success: true,
          sessionId: result.sessionId,
          jobId: result.jobId,
          provider: result.provider,
          providerId: result.providerId,
          message: result.message,
          supportedOtpLengths: result.supportedOtpLengths,
          dispatchTimeMs: result.dispatchTimeMs,
        });
      } catch (authErr: unknown) {
        const errMsg = authErr instanceof Error ? authErr.message : String(authErr);
        return jsonResponse(
          {
            status: "error",
            message: errMsg,
            error: errMsg,
            success: false,
          },
          400,
        );
      }
    }

    // 2C. ASYNC OTP DISPATCH JOB STATUS
    if (path.startsWith("/api/v1/providers/otp/status") && method === "GET") {
      const jobId = path.split("/").pop() || url.searchParams.get("jobId") || "";
      const job = dynamicProviderEngine.getJobStatus(jobId);
      if (!job) {
        return jsonResponse({ status: "error", message: "Job not found" }, 404);
      }
      return jsonResponse({ status: "success", success: true, job });
    }

    // 2C. DYNAMIC PROVIDER OTP VERIFICATION & FLEXIBLE DIGIT INPUT (4, 5, or 6 Digits)
    if (
      (path === "/api/v1/providers/auth/verify-otp" ||
        path === "/api/v1/providers/otp/verify" ||
        path === "/api/v1/providers/mobikwik/verify") &&
      method === "POST"
    ) {
      const body = await req.json().catch(() => ({}));
      const { sessionId = "", mobile, phone, otp, code, userId = "usr_demo_seller_1" } = body;
      const targetPhone = (mobile || phone || "").toString();
      const targetOtp = (otp || code || "").toString().trim();

      try {
        if (sessionId.startsWith("mbk_sess_")) {
          // Legacy session fallback
          const verification = await mobikwikProviderAdapter.verifyOtpAndCaptureSession(
            sessionId,
            targetPhone,
            targetOtp,
          );
          if (verification.identifiers.length > 0) {
            await singleBindingManager.bindIdentifier(
              userId,
              "mobikwik_direct",
              verification.identifiers[0],
              userId,
            );
          }
          return jsonResponse({
            status: "success",
            success: true,
            message: "Provider session authorized and transactions synced successfully",
            authToken: verification.authToken,
            account: verification.account,
            identifiers: verification.identifiers,
            transactions: verification.transactions,
          });
        }

        const verification = await dynamicProviderEngine.verifyDynamicOtp(
          sessionId,
          targetPhone,
          targetOtp,
          userId,
        );

        return jsonResponse({
          status: "success",
          success: true,
          message: verification.message,
          authToken: verification.authToken,
          account: verification.account,
          identifiers: verification.identifiers,
          transactions: verification.transactions,
        });
      } catch (verifyErr: unknown) {
        const errMsg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
        return jsonResponse(
          {
            status: "error",
            message: errMsg,
            error: errMsg,
            success: false,
          },
          400,
        );
      }
    }

    // 2D. LIVE TRANSACTION STATEMENT FOR AUTOMATED UTR MATCHING
    if (path === "/api/v1/providers/statement" && method === "GET") {
      const authToken =
        url.searchParams.get("token") ||
        url.searchParams.get("authToken") ||
        req.headers.get("authorization")?.replace("Bearer ", "") ||
        "";

      try {
        let transactions = await dynamicProviderEngine.getTransactions(authToken);
        if (!transactions || transactions.length === 0) {
          transactions = await mobikwikProviderAdapter.getTransactions(authToken);
        }
        return jsonResponse({ success: true, count: transactions.length, transactions });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return jsonResponse({ error: msg }, 401);
      }
    }

    // ------------------------------------------------------------------------
    // 3. SINGLE-BINDING ACCOUNT MANAGEMENT
    // ------------------------------------------------------------------------
    if (path === "/api/v1/accounts/active-binding" && method === "GET") {
      const userId = url.searchParams.get("user_id") || "usr_demo_seller_1";
      const activeBinding = await singleBindingManager.getActiveBinding(userId);
      return jsonResponse({ success: true, activeBinding });
    }

    if (path === "/api/v1/accounts/bind" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { userId = "usr_demo_seller_1", providerId = "mock_upi_gateway", identifier } = body;

      if (!identifier || !identifier.value) {
        return jsonResponse({ error: "Invalid payment identifier" }, 400);
      }

      const binding = await singleBindingManager.bindIdentifier(
        userId,
        providerId,
        identifier,
        userId,
      );
      return jsonResponse({
        success: true,
        message: "Payment identifier bound successfully (Single Active Binding enforced)",
        binding,
      });
    }

    if (path === "/api/v1/accounts/unbind" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { userId = "usr_demo_seller_1" } = body;
      const success = await singleBindingManager.unbindIdentifier(userId);
      return jsonResponse({
        success,
        message: success ? "Unbound successfully" : "No active binding",
      });
    }

    // ------------------------------------------------------------------------
    // 4. P2P MARKETPLACE & ORDER BOOK
    // ------------------------------------------------------------------------
    if (path === "/api/v1/marketplace/ads" && method === "GET") {
      const type = (url.searchParams.get("type") as "BUY" | "SELL") || undefined;
      const asset = url.searchParams.get("asset") || undefined;
      const amountInr = url.searchParams.get("amount")
        ? Number(url.searchParams.get("amount"))
        : undefined;

      const ads = matchingEngine.getMarketplaceAds({ type, asset, amountInr });
      return jsonResponse({ success: true, count: ads.length, ads });
    }

    // ------------------------------------------------------------------------
    // 5. P2P TRADE ENGINE & STATE MACHINE
    // ------------------------------------------------------------------------
    if (path === "/api/v1/trades/create" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { adId, buyerId = "usr_demo_buyer_1", fiatAmount, paymentMethod = "UPI" } = body;

      if (!adId || !fiatAmount || fiatAmount <= 0) {
        return jsonResponse({ error: "Invalid trade parameters" }, 400);
      }

      const trade = matchingEngine.createTrade({
        adId,
        buyerId,
        fiatAmount: Number(fiatAmount),
        paymentMethod,
      });

      return jsonResponse({ success: true, trade });
    }

    if (path === "/api/v1/trades/list" && method === "GET") {
      const trades = matchingEngine.getAllTrades();
      return jsonResponse({ success: true, count: trades.length, trades });
    }

    if (
      path.startsWith("/api/v1/trades/") &&
      !path.includes("/verify") &&
      !path.includes("/cancel") &&
      method === "GET"
    ) {
      const tradeId = path.replace("/api/v1/trades/", "").trim();
      const trade = matchingEngine.getTrade(tradeId);
      if (!trade) {
        return jsonResponse({ error: "Trade not found" }, 404);
      }
      return jsonResponse({ success: true, trade });
    }

    // ------------------------------------------------------------------------
    // 6. 100% AUTOMATED SERVER-SIDE BACKGROUND VERIFICATION
    // (Legacy manual UTR checking & screenshot upload permanently purged)
    // ------------------------------------------------------------------------
    if (path.includes("/verify-utr") && method === "POST") {
      const body = await req.json().catch(() => ({}));
      let tradeId = body.tradeId;
      if (!tradeId && path.startsWith("/api/v1/trades/")) {
        tradeId = path.replace("/api/v1/trades/", "").replace("/verify-utr", "").trim();
      }

      const submittedUtr = body.utr || body.reference || body.upi_ref || body.ref_no;

      if (!submittedUtr) {
        return jsonResponse({ error: "12-digit numeric UTR is required for verification" }, 400);
      }

      let trade = tradeId ? matchingEngine.getTrade(tradeId) : undefined;

      // If no specific tradeId provided (e.g. from standalone quick verify), create/match dynamic trade
      if (!trade) {
        const ads = matchingEngine.getMarketplaceAds({ type: "SELL" });
        const defaultAd = ads[0] || { id: "ad_sell_1" };
        trade = matchingEngine.createTrade({
          adId: defaultAd.id,
          buyerId: "usr_demo_buyer_1",
          fiatAmount: body.amount ? Number(body.amount) : 500.0,
          paymentMethod: "UPI",
        });
      }

      // Execute authoritative automated server-side verification
      const verificationResult = await AutomatedVerificationPipeline.verifyTradePayment(
        trade,
        submittedUtr,
      );

      if (verificationResult.trade) {
        matchingEngine.updateTrade(verificationResult.trade);
      }

      return jsonResponse({
        success: verificationResult.verified,
        code: verificationResult.code,
        message: verificationResult.message,
        trade: verificationResult.trade || trade,
        matchedTransaction: verificationResult.matchedTransaction,
        verifiedAt: verificationResult.verifiedAt,
      });
    }

    if (path.includes("/cancel") && method === "POST") {
      const tradeId = path.replace("/api/v1/trades/", "").replace("/cancel", "").trim();
      const trade = matchingEngine.getTrade(tradeId);
      if (!trade) return jsonResponse({ error: "Trade not found" }, 404);

      const res = TradeStateMachine.transition(trade, "CANCELLED", "USER", "Cancelled by user");
      matchingEngine.updateTrade(res.trade);
      return jsonResponse({ success: true, trade: res.trade });
    }

    // ------------------------------------------------------------------------
    // 7. OBSERVABILITY & WORKER METRICS
    // ------------------------------------------------------------------------
    if (path === "/api/v1/engine/metrics" && method === "GET") {
      const metrics = backgroundQueue.getMetrics();
      return jsonResponse({
        success: true,
        status: "HEALTHY",
        engine: "CrazyPay Custom P2P Engine (Read-Only Settlement)",
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: Date.now(),
        metrics,
      });
    }

    return null;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return jsonResponse(
      { status: "error", message: errorMsg, error: errorMsg, success: false },
      500,
    );
  }
}
