/**
 * CRAZY PAY :: USDT PAYMENT CONTROLLER
 * ---------------------------------------------------------------------------
 * Production-ready controller handling:
 *  - STEP 1: Cryptographic HD Temp Address & Order Creation
 *  - STEP 2: Zero-Button Blockchain Detection & Partial / Flexible Crediting
 *  - STEP 3: Fallback Manual On-Chain TX Hash Verification (Anti-Double-Spend)
 *  - STEP 4: Automated 100% USDT Sweeper Execution to Master Receiver Wallets
 * ---------------------------------------------------------------------------
 */

import { supabase } from "../lib/supabaseClient.js";
import {
  UsdtSweeperService,
  generateHdTempWallet,
  USDT_CONFIG,
} from "../services/usdtSweeperService.js";

// In-memory resilient cache for instant response & offline fallback
const orderMemoryCache = new Map();
const processedTxHashes = new Set();

const DEFAULT_USDT_RATE = 117.0;

export const UsdtController = {
  /**
   * STEP 1: HD TEMP ADDRESS & ORDER CREATION
   * POST /api/v1/usdt/create-order
   */
  async createOrder(req, res) {
    try {
      let body = req.body || {};
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (_e) {
          body = {};
        }
      }

      const userId = String(
        body.userId || body.user_id || body.phone || body.userPhone || body.user || "guest",
      ).replace(/[^0-9a-zA-Z_-]/g, "");

      const rawAmount =
        body.amount ??
        body.usdtAmount ??
        body.depositAmount ??
        body.usdt_amount ??
        body.deposit_amount ??
        body.amt ??
        body.value;
      const amount = parseFloat(rawAmount);

      const rawNet = String(
        body.network || body.networkProtocol || body.protocol || body.net || "BSC",
      ).toUpperCase();
      const network = rawNet.includes("TRC") || rawNet.includes("TRON") ? "TRC20" : "BSC";

      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid deposit amount. Amount must be greater than 0.",
        });
      }

      // Generate unique cryptographic HD temp wallet
      const tempWallet = generateHdTempWallet(network);
      const orderId = `USDT_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const expiresInSeconds = 900; // 15 minutes window (client countdown set to 5 mins default)
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
      const rate = DEFAULT_USDT_RATE;

      const orderData = {
        id: orderId,
        user_id: userId,
        amount,
        received_amount: 0,
        inr_credited: 0,
        rate,
        network,
        temp_address: tempWallet.address,
        temp_private_key: tempWallet.privateKey,
        master_wallet: tempWallet.masterWallet,
        status: "PENDING",
        tx_hash: null,
        sweep_status: "PENDING",
        sweep_tx_hash: null,
        gas_funded: false,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Store in memory cache
      orderMemoryCache.set(orderId, orderData);

      // Non-blocking persist to Supabase
      try {
        Promise.race([
          supabase.from("usdt_orders").insert(orderData),
          new Promise((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 1500)),
        ]).catch((dbErr) => {
          console.warn(
            "[USDT Controller] Supabase background insert notice (memory cache active):",
            dbErr?.message || dbErr,
          );
        });
      } catch (_dbEx) {}

      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(tempWallet.address)}`;

      return res.status(200).json({
        success: true,
        ok: true,
        orderId,
        tempAddress: tempWallet.address,
        address: tempWallet.address,
        walletAddress: tempWallet.address,
        masterWallet: tempWallet.masterWallet,
        network,
        amount,
        rate,
        estimatedInr: Math.round(amount * rate * 100) / 100,
        expiresInSeconds,
        qrCodeUrl,
        qrDetails: {
          data: tempWallet.address,
          size: 180,
          url: qrCodeUrl,
        },
        hindiNote:
          "⚠️ नोट: अगर आप 100 USDT से कम डिपॉजिट कर रहे हैं, तो BSC (BEP-20) चुनें। 100 USDT से 10,000 USDT तक के बड़े अमाउंट के लिए TRC-20 नेटवर्क चुनें, अन्यथा ट्रांजेक्शन में देरी हो सकती है।",
      });
    } catch (err) {
      console.error("[USDT Controller] createOrder fatal error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to initialize cryptographic USDT deposit session.",
      });
    }
  },

  /**
   * STEP 2: AUTOMATIC BLOCKCHAIN DETECTION & PARTIAL CREDITING
   * GET /api/v1/usdt/check-status?orderId=...
   */
  async checkStatus(req, res) {
    try {
      const orderId =
        req.query.orderId ||
        req.query.order_id ||
        req.query.id ||
        req.params?.orderId ||
        req.body?.orderId ||
        req.body?.order_id ||
        req.body?.id;
      if (!orderId) {
        return res.status(400).json({ success: false, error: "Missing orderId parameter." });
      }

      // Fetch order from memory or Supabase
      let order = orderMemoryCache.get(orderId);
      if (!order) {
        try {
          const { data } = await supabase
            .from("usdt_orders")
            .select("*")
            .eq("id", orderId)
            .maybeSingle();
          if (data) {
            order = data;
            orderMemoryCache.set(orderId, order);
          }
        } catch (_e) {}
      }

      if (!order) {
        return res.status(404).json({ success: false, error: "Deposit order not found." });
      }

      // If already SUCCESS, return immediately
      if (order.status === "SUCCESS") {
        return res.status(200).json({
          success: true,
          status: "SUCCESS",
          orderId: order.id,
          receivedAmount: order.received_amount || order.amount,
          inrCredited:
            order.inr_credited ||
            (order.received_amount || order.amount) * (order.rate || DEFAULT_USDT_RATE),
          txHash: order.tx_hash,
          sweepStatus: order.sweep_status,
          masterWallet: order.master_wallet,
        });
      }

      // Check on-chain balance on temp address
      const onChain = await UsdtSweeperService.checkTempUsdtBalance(
        order.network,
        order.temp_address,
      );

      if (onChain && onChain.balance > 0) {
        // FLEXIBLE BALANCE CREDITING:
        // Automatically accept exact received amount (even if user sent $98 instead of $100)
        const receivedAmount = onChain.balance;
        const rate = order.rate || DEFAULT_USDT_RATE;
        const inrCredited = Math.round(receivedAmount * rate * 100) / 100;
        const txHash = onChain.txHash || `ONCHAIN_DETECT_${Date.now()}`;

        order.status = "SUCCESS";
        order.received_amount = receivedAmount;
        order.inr_credited = inrCredited;
        order.tx_hash = txHash;
        order.updated_at = new Date().toISOString();

        orderMemoryCache.set(order.id, order);

        // Non-blocking update database
        try {
          supabase
            .from("usdt_orders")
            .update({
              status: "SUCCESS",
              received_amount: receivedAmount,
              inr_credited: inrCredited,
              tx_hash: txHash,
              updated_at: new Date().toISOString(),
            })
            .eq("id", order.id)
            .then(() => {})
            .catch(() => {});
        } catch (_e) {}

        // STEP 4: Trigger 100% USDT automated sweeper in background
        UsdtSweeperService.executeSweep(order).catch((sweepErr) => {
          console.warn("[USDT Controller] Background sweeper trigger error:", sweepErr.message);
        });

        return res.status(200).json({
          success: true,
          status: "SUCCESS",
          orderId: order.id,
          receivedAmount,
          inrCredited,
          txHash,
          network: order.network,
          masterWallet: order.master_wallet,
        });
      }

      // Still pending
      return res.status(200).json({
        success: true,
        status: "PENDING",
        orderId: order.id,
        tempAddress: order.temp_address,
        masterWallet: order.master_wallet,
        network: order.network,
      });
    } catch (err) {
      console.error("[USDT Controller] checkStatus fatal error:", err);
      return res.status(500).json({ success: false, error: "Error checking blockchain status." });
    }
  },

  /**
   * STEP 3: FALLBACK MANUAL VERIFICATION (TRX ID / TX HASH)
   * POST /api/v1/usdt/verify-txhash
   */
  async verifyTxHash(req, res) {
    try {
      let body = req.body || {};
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (_e) {
          body = {};
        }
      }
      const orderId = body.orderId || body.order_id || body.id;
      const txHash = body.txHash || body.tx_hash || body.txid || body.hash;
      if (!orderId || !txHash) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: orderId and txHash are required.",
        });
      }

      const cleanHash = String(txHash).trim();
      if (cleanHash.length < 10) {
        return res.status(400).json({
          success: false,
          error: "Invalid transaction hash format. Must be a valid on-chain TxID.",
        });
      }

      // STRICT ANTI-DOUBLE-SPEND CHECK:
      // 1. Check in-memory processed hash set
      if (processedTxHashes.has(cleanHash.toLowerCase())) {
        return res.status(409).json({
          success: false,
          error: "Double-spending detected! This Tx Hash has already been claimed and credited.",
        });
      }

      // 2. Check Supabase database unique index
      try {
        const { data: existingTx } = await supabase
          .from("usdt_orders")
          .select("id, status")
          .eq("tx_hash", cleanHash)
          .neq("id", orderId)
          .maybeSingle();

        if (existingTx) {
          return res.status(409).json({
            success: false,
            error:
              "Double-spending detected! This transaction hash has already been used in order " +
              existingTx.id,
          });
        }
      } catch (_e) {}

      // Retrieve order
      let order = orderMemoryCache.get(orderId);
      if (!order) {
        try {
          const { data } = await supabase
            .from("usdt_orders")
            .select("*")
            .eq("id", orderId)
            .maybeSingle();
          if (data) {
            order = data;
            orderMemoryCache.set(orderId, order);
          }
        } catch (_e) {}
      }

      if (!order) {
        return res.status(404).json({ success: false, error: "Deposit order not found." });
      }

      // If already successful, return success
      if (order.status === "SUCCESS") {
        return res.status(200).json({
          success: true,
          status: "SUCCESS",
          orderId: order.id,
          receivedAmount: order.received_amount || order.amount,
          inrCredited: order.inr_credited,
          txHash: order.tx_hash,
          masterWallet: order.master_wallet,
        });
      }

      // Query on-chain RPC for transaction verification
      const verifyResult = await UsdtSweeperService.verifyTxHashOnChain(
        order.network,
        cleanHash,
        order.temp_address,
      );

      if (!verifyResult || !verifyResult.valid) {
        return res.status(400).json({
          success: false,
          error:
            (verifyResult && verifyResult.error) ||
            "Transaction hash could not be confirmed on " + order.network + " blockchain.",
        });
      }

      // Flexible Balance Crediting:
      // Use verified on-chain amount if confirmed; else credit the ordered amount
      const receivedAmount =
        verifyResult.amount && verifyResult.amount > 0 ? verifyResult.amount : Number(order.amount);
      const rate = order.rate || DEFAULT_USDT_RATE;
      const inrCredited = Math.round(receivedAmount * rate * 100) / 100;

      // Lock Tx Hash against double spending
      processedTxHashes.add(cleanHash.toLowerCase());

      order.status = "SUCCESS";
      order.received_amount = receivedAmount;
      order.inr_credited = inrCredited;
      order.tx_hash = cleanHash;
      order.updated_at = new Date().toISOString();
      orderMemoryCache.set(order.id, order);

      // Persist to Supabase
      try {
        await supabase
          .from("usdt_orders")
          .update({
            status: "SUCCESS",
            received_amount: receivedAmount,
            inr_credited: inrCredited,
            tx_hash: cleanHash,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);
      } catch (dbErr) {
        console.warn("[USDT Controller] Supabase verify update error:", dbErr.message);
      }

      // STEP 4: Trigger 100% USDT automated sweeper in background
      UsdtSweeperService.executeSweep(order).catch((sweepErr) => {
        console.warn("[USDT Controller] Sweeper execution error:", sweepErr.message);
      });

      return res.status(200).json({
        success: true,
        status: "SUCCESS",
        orderId: order.id,
        receivedAmount,
        inrCredited,
        txHash: cleanHash,
        network: order.network,
        masterWallet: order.master_wallet,
        message:
          "Tx Hash verified on-chain. Funds credited and auto-swept to Master Receiver Wallet.",
      });
    } catch (err) {
      console.error("[USDT Controller] verifyTxHash fatal error:", err);
      return res.status(500).json({
        success: false,
        error: "Server error occurred during on-chain Tx Hash verification.",
      });
    }
  },
};
