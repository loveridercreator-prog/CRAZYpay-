/**
 * CRAZYPAY P2P MARKETPLACE MATCHING ENGINE
 * ============================================================================
 * Deterministic Price-Time Priority Matching Engine.
 * Matches Buy/Sell Ads, enforces limits, supports atomic trade creation.
 * ============================================================================
 */

import { P2pTrade } from "./state-machine";

export interface P2pOrderAd {
  id: string;
  userId: string;
  userDisplayName: string;
  type: "BUY" | "SELL";
  asset: "USDT" | "BTC" | "INR_BALANCE";
  fiatCurrency: "INR";
  price: number; // INR per USDT (e.g. 91.50)
  totalAmount: number; // in USDT
  availableAmount: number; // in USDT
  minLimitInr: number; // e.g. ₹500
  maxLimitInr: number; // e.g. ₹50,000
  paymentMethods: ("UPI" | "IMPS" | "BANK_TRANSFER")[];
  paymentIdentifier: string; // Bound payment ID
  merchantStats: {
    totalTrades: number;
    completionRate: number; // e.g. 99.4%
    avgReleaseTimeMinutes: number;
  };
  createdAt: number;
  isActive: boolean;
}

class MatchingEngine {
  private orderBook: Map<string, P2pOrderAd> = new Map();
  private trades: Map<string, P2pTrade> = new Map();

  constructor() {
    this.seedMarketplaceAds();
  }

  private seedMarketplaceAds() {
    const seedAds: P2pOrderAd[] = [
      {
        id: "ad_sell_1",
        userId: "usr_merchant_1",
        userDisplayName: "CrazyPay Verified Express",
        type: "SELL",
        asset: "USDT",
        fiatCurrency: "INR",
        price: 91.2,
        totalAmount: 5000,
        availableAmount: 4850,
        minLimitInr: 500,
        maxLimitInr: 100000,
        paymentMethods: ["UPI", "IMPS"],
        paymentIdentifier: "crazypay.express@okaxis",
        merchantStats: {
          totalTrades: 3840,
          completionRate: 99.8,
          avgReleaseTimeMinutes: 1.2,
        },
        createdAt: Date.now() - 1000 * 60 * 60 * 2,
        isActive: true,
      },
      {
        id: "ad_sell_2",
        userId: "usr_merchant_2",
        userDisplayName: "FastTrack P2P Settlements",
        type: "SELL",
        asset: "USDT",
        fiatCurrency: "INR",
        price: 91.35,
        totalAmount: 12000,
        availableAmount: 11200,
        minLimitInr: 1000,
        maxLimitInr: 250000,
        paymentMethods: ["UPI"],
        paymentIdentifier: "fasttrack.p2p@ybl",
        merchantStats: {
          totalTrades: 1950,
          completionRate: 99.1,
          avgReleaseTimeMinutes: 2.0,
        },
        createdAt: Date.now() - 1000 * 60 * 60 * 5,
        isActive: true,
      },
      {
        id: "ad_buy_1",
        userId: "usr_buyer_merchant_1",
        userDisplayName: "Prime Liquidity Buyer",
        type: "BUY",
        asset: "USDT",
        fiatCurrency: "INR",
        price: 90.8,
        totalAmount: 8000,
        availableAmount: 7600,
        minLimitInr: 1000,
        maxLimitInr: 150000,
        paymentMethods: ["UPI", "IMPS"],
        paymentIdentifier: "primeliquidity@icici",
        merchantStats: {
          totalTrades: 2410,
          completionRate: 99.5,
          avgReleaseTimeMinutes: 1.5,
        },
        createdAt: Date.now() - 1000 * 60 * 60 * 10,
        isActive: true,
      },
    ];

    seedAds.forEach((ad) => this.orderBook.set(ad.id, ad));
  }

  /**
   * List active ads with filtering and price-time priority sorting
   */
  getMarketplaceAds(filter?: {
    type?: "BUY" | "SELL";
    asset?: string;
    amountInr?: number;
    paymentMethod?: string;
  }): P2pOrderAd[] {
    let ads = Array.from(this.orderBook.values()).filter(
      (a) => a.isActive && a.availableAmount > 0,
    );

    if (filter) {
      if (filter.type) {
        ads = ads.filter((a) => a.type === filter.type);
      }
      if (filter.asset) {
        ads = ads.filter((a) => a.asset === filter.asset);
      }
      if (filter.amountInr && filter.amountInr > 0) {
        ads = ads.filter(
          (a) => filter.amountInr! >= a.minLimitInr && filter.amountInr! <= a.maxLimitInr,
        );
      }
      if (filter.paymentMethod) {
        ads = ads.filter((a) =>
          a.paymentMethods.includes(filter.paymentMethod as "UPI" | "IMPS" | "BANK_TRANSFER"),
        );
      }
    }

    // Sort by Best Price first, then by Creation Timestamp (Price-Time Priority)
    ads.sort((a, b) => {
      if (a.type === "SELL") {
        // Lower price is better for buyers
        if (a.price !== b.price) return a.price - b.price;
      } else {
        // Higher price is better for sellers
        if (a.price !== b.price) return b.price - a.price;
      }
      return a.createdAt - b.createdAt;
    });

    return ads;
  }

  /**
   * Create a new P2P trade matching buyer and seller
   */
  createTrade(params: {
    adId: string;
    buyerId: string;
    fiatAmount: number;
    paymentMethod: "UPI" | "IMPS" | "BANK_TRANSFER";
  }): P2pTrade {
    const ad = this.orderBook.get(params.adId);
    if (!ad || !ad.isActive) {
      throw new Error("Marketplace Ad is no longer available or inactive");
    }

    if (params.fiatAmount < ad.minLimitInr || params.fiatAmount > ad.maxLimitInr) {
      throw new Error(
        `Amount must be between ₹${ad.minLimitInr.toLocaleString()} and ₹${ad.maxLimitInr.toLocaleString()}`,
      );
    }

    const cryptoAmount = Number((params.fiatAmount / ad.price).toFixed(2));
    if (cryptoAmount > ad.availableAmount) {
      throw new Error(`Insufficient liquidity. Available: ${ad.availableAmount} ${ad.asset}`);
    }

    // Deduct available amount atomically
    ad.availableAmount = Number((ad.availableAmount - cryptoAmount).toFixed(2));
    if (ad.availableAmount <= 0) {
      ad.isActive = false;
    }

    const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    const trade: P2pTrade = {
      tradeId,
      orderId: `CP-${Math.floor(100000 + Math.random() * 900000)}`,
      buyerId: params.buyerId,
      sellerId: ad.userId,
      asset: ad.asset,
      assetAmount: cryptoAmount,
      fiatCurrency: "INR",
      fiatAmount: params.fiatAmount,
      exchangeRate: ad.price,
      paymentMethod: params.paymentMethod,
      boundPaymentIdentifier: ad.paymentIdentifier,
      sellerAccountHolder: ad.userDisplayName,
      status: "PAYMENT_PENDING",
      createdAt: now,
      matchedAt: now,
      expiresAt: now + 1000 * 60 * 15, // 15 minutes window
      verificationAttempts: 0,
      verificationAuditLog: [
        `[${new Date(now).toISOString()}] Trade created matching Ad ${ad.id}. Amount: ₹${params.fiatAmount} (${cryptoAmount} USDT)`,
      ],
    };

    this.trades.set(tradeId, trade);
    return trade;
  }

  getTrade(tradeId: string): P2pTrade | undefined {
    return this.trades.get(tradeId);
  }

  getAllTrades(): P2pTrade[] {
    return Array.from(this.trades.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  updateTrade(trade: P2pTrade) {
    this.trades.set(trade.tradeId, trade);
  }
}

export const matchingEngine = new MatchingEngine();
