/**
 * CRAZYPAY MOCK PROVIDER ADAPTER
 * ============================================================================
 * High-fidelity, deterministic Mock Provider simulating official OAuth &
 * authorized read-only transaction feeds for SBI, HDFC, Paytm Bank, and ICICI UPI.
 * ============================================================================
 */

import {
  ProviderReadAdapter,
  ProviderMetadata,
  ProviderAuthResult,
  ProviderAccountDetails,
  PaymentIdentifier,
  ProviderTransaction,
  TransactionFilter,
} from "./types";

export class MockProviderAdapter implements ProviderReadAdapter {
  readonly metadata: ProviderMetadata;
  private inMemoryTransactions: Map<string, ProviderTransaction[]> = new Map();
  private inMemoryAccounts: Map<string, ProviderAccountDetails> = new Map();

  constructor(
    providerId: string = "mock_upi_gateway",
    providerName: string = "Mock Instant UPI Gateway",
  ) {
    this.metadata = {
      id: providerId,
      name: providerName,
      displayName: "Official UPI Settlement Gateway (Read-Only)",
      category: "UPI_GATEWAY",
      supportedCurrencies: ["INR"],
      requiresOAuth: true,
      authUrl: `/api/v1/providers/${providerId}/oauth`,
      apiVersion: "v2.4-readonly",
      isAvailable: true,
      capabilities: ["READ_ACCOUNTS", "READ_IDENTIFIERS", "READ_TRANSACTIONS", "READ_STATUS"],
    };

    this.seedDefaultMockData();
  }

  private seedDefaultMockData() {
    const defaultUserId = "usr_demo_seller_1";
    const defaultToken = `mock_token_${defaultUserId}`;

    const defaultIdentifiers: PaymentIdentifier[] = [
      {
        id: "id_upi_1",
        type: "UPI_ID",
        value: "crazypay.seller@okaxis",
        accountHolderName: "CrazyPay Verified Merchant",
        provider: this.metadata.id,
        isDefault: true,
        status: "ACTIVE",
        metadata: { vpaHandle: "okaxis", verified: true },
      },
      {
        id: "id_upi_2",
        type: "UPI_NUMBER",
        value: "9708634584",
        accountHolderName: "CrazyPay Verified Merchant",
        provider: this.metadata.id,
        isDefault: false,
        status: "ACTIVE",
      },
    ];

    this.inMemoryAccounts.set(defaultToken, {
      accountId: "acc_mock_988273",
      providerId: this.metadata.id,
      accountHolderName: "CrazyPay Verified Merchant",
      maskedAccountNo: "XXXX-XXXX-4584",
      currency: "INR",
      identifiers: defaultIdentifiers,
      accountStatus: "ACTIVE",
      lastSyncedAt: Date.now(),
    });

    this.inMemoryTransactions.set(defaultToken, [
      {
        transactionId: "tx_mock_1001",
        referenceNumber: "426189920194",
        amount: 500.0,
        currency: "INR",
        direction: "CREDIT",
        status: "SUCCESS",
        timestamp: Date.now() - 1000 * 60 * 5,
        payerIdentifier: "buyer@okhdfcbank",
        payeeIdentifier: "crazypay.seller@okaxis",
        note: "P2P Buy Order #CP-8921",
      },
      {
        transactionId: "tx_mock_1002",
        referenceNumber: "426189920195",
        amount: 2000.0,
        currency: "INR",
        direction: "CREDIT",
        status: "SUCCESS",
        timestamp: Date.now() - 1000 * 60 * 15,
        payerIdentifier: "trader99@paytm",
        payeeIdentifier: "crazypay.seller@okaxis",
        note: "P2P Settlement",
      },
    ]);
  }

  async getAuthorizationUrl(state: string, redirectUri: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: "crazypay_p2p_app",
      response_type: "code",
      scope: "read_accounts,read_transactions",
      state,
      redirect_uri: redirectUri,
    });
    return `/api/v1/providers/oauth/authorize?${params.toString()}`;
  }

  async exchangeAuthCode(code: string, _redirectUri: string): Promise<ProviderAuthResult> {
    const userId = code.replace("code_", "") || "usr_" + Date.now();
    const token = `token_live_${userId}_${Math.random().toString(36).substring(2, 9)}`;

    // Create realistic dynamic account
    const sampleUpi = `user.${userId.slice(-4)}@okaxis`;
    const identifiers: PaymentIdentifier[] = [
      {
        id: `upi_${Date.now()}`,
        type: "UPI_ID",
        value: sampleUpi,
        accountHolderName: `Trader ${userId.slice(-4).toUpperCase()}`,
        provider: this.metadata.id,
        isDefault: true,
        status: "ACTIVE",
      },
    ];

    this.inMemoryAccounts.set(token, {
      accountId: `acc_${userId}`,
      providerId: this.metadata.id,
      accountHolderName: `Trader ${userId.slice(-4).toUpperCase()}`,
      maskedAccountNo: `XXXX-XXXX-${Math.floor(1000 + Math.random() * 9000)}`,
      currency: "INR",
      identifiers,
      accountStatus: "ACTIVE",
      lastSyncedAt: Date.now(),
    });

    this.inMemoryTransactions.set(token, []);

    return {
      success: true,
      providerId: this.metadata.id,
      providerUserId: userId,
      accessToken: token,
      refreshToken: `refresh_${token}`,
      tokenExpiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days
      scopes: ["read_accounts", "read_transactions"],
      maskedAccountNo: `XXXX-XXXX-${Math.floor(1000 + Math.random() * 9000)}`,
      providerUsername: sampleUpi,
    };
  }

  async refreshToken(refreshToken: string): Promise<ProviderAuthResult> {
    const oldToken = refreshToken.replace("refresh_", "");
    const newToken = `token_refreshed_${Math.random().toString(36).substring(2, 9)}`;

    if (this.inMemoryAccounts.has(oldToken)) {
      const acc = this.inMemoryAccounts.get(oldToken)!;
      this.inMemoryAccounts.set(newToken, acc);
      const txs = this.inMemoryTransactions.get(oldToken) || [];
      this.inMemoryTransactions.set(newToken, txs);
    }

    return {
      success: true,
      providerId: this.metadata.id,
      providerUserId: "user_refreshed",
      accessToken: newToken,
      refreshToken: `refresh_${newToken}`,
      tokenExpiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30,
      scopes: ["read_accounts", "read_transactions"],
    };
  }

  async getAccount(accessToken: string): Promise<ProviderAccountDetails> {
    const acc = this.inMemoryAccounts.get(accessToken);
    if (!acc) {
      // Return fallback demo account if unknown token
      return {
        accountId: "acc_demo_generic",
        providerId: this.metadata.id,
        accountHolderName: "CrazyPay Verified Trader",
        maskedAccountNo: "XXXX-XXXX-9901",
        currency: "INR",
        identifiers: [
          {
            id: "id_upi_fallback",
            type: "UPI_ID",
            value: "crazypay.fallback@okaxis",
            accountHolderName: "CrazyPay Verified Trader",
            provider: this.metadata.id,
            isDefault: true,
            status: "ACTIVE",
          },
        ],
        accountStatus: "ACTIVE",
        lastSyncedAt: Date.now(),
      };
    }
    return { ...acc, lastSyncedAt: Date.now() };
  }

  async getPaymentIdentifiers(accessToken: string): Promise<PaymentIdentifier[]> {
    const acc = await this.getAccount(accessToken);
    return acc.identifiers;
  }

  async getTransactions(
    accessToken: string,
    filter?: TransactionFilter,
  ): Promise<ProviderTransaction[]> {
    let txs = this.inMemoryTransactions.get(accessToken) || [];
    if (txs.length === 0) {
      // Also check if any transaction was registered in mock engine
      const fallbackTxs = this.inMemoryTransactions.get("mock_token_usr_demo_seller_1") || [];
      txs = [...fallbackTxs];
    }

    if (filter) {
      if (filter.sinceTimestamp) {
        txs = txs.filter((t) => t.timestamp >= filter.sinceTimestamp!);
      }
      if (filter.referenceNumber) {
        txs = txs.filter((t) => t.referenceNumber === filter.referenceNumber);
      }
      if (filter.minAmount !== undefined) {
        txs = txs.filter((t) => t.amount >= filter.minAmount!);
      }
      if (filter.maxAmount !== undefined) {
        txs = txs.filter((t) => t.amount <= filter.maxAmount!);
      }
      if (filter.direction) {
        txs = txs.filter((t) => t.direction === filter.direction);
      }
      if (filter.limit && filter.limit > 0) {
        txs = txs.slice(0, filter.limit);
      }
    }
    return txs;
  }

  async getTransactionByReference(
    accessToken: string,
    referenceNumber: string,
  ): Promise<ProviderTransaction | null> {
    const txs = await this.getTransactions(accessToken, { referenceNumber });
    return txs.length > 0 ? txs[0] : null;
  }

  /**
   * Test helper to inject simulated bank credit into mock stream (e.g. buyer pays seller)
   */
  injectSimulatedCredit(
    accessToken: string,
    tx: Omit<ProviderTransaction, "transactionId" | "direction" | "status">,
  ): ProviderTransaction {
    const fullTx: ProviderTransaction = {
      ...tx,
      transactionId: `tx_sim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      direction: "CREDIT",
      status: "SUCCESS",
    };

    const existing = this.inMemoryTransactions.get(accessToken) || [];
    existing.unshift(fullTx);
    this.inMemoryTransactions.set(accessToken, existing);

    // Also inject into demo seller token
    const demoTxs = this.inMemoryTransactions.get("mock_token_usr_demo_seller_1") || [];
    demoTxs.unshift(fullTx);
    this.inMemoryTransactions.set("mock_token_usr_demo_seller_1", demoTxs);

    return fullTx;
  }
}
