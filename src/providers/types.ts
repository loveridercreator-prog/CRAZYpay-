/**
 * CRAZYPAY PAYMENT PROVIDER INTERFACES (STRICT READ-ONLY ARCHITECTURE)
 * ============================================================================
 * Security Mandate:
 * - This integration layer is STRICTLY READ-ONLY.
 * - Under NO circumstance does this layer implement or expose payment initiation,
 *   fund transfer, debit, withdrawal, or balance manipulation methods.
 * ============================================================================
 */

export interface ProviderMetadata {
  id: string;
  name: string;
  displayName: string;
  category: "UPI_GATEWAY" | "BANK_ACCOUNT" | "NEOBANK" | "DIGITAL_WALLET";
  supportedCurrencies: string[];
  requiresOAuth: boolean;
  authUrl?: string;
  apiVersion: string;
  isAvailable: boolean;
  capabilities: ("READ_ACCOUNTS" | "READ_IDENTIFIERS" | "READ_TRANSACTIONS" | "READ_STATUS")[];
}

export interface ProviderAuthResult {
  success: boolean;
  providerId: string;
  providerUserId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: number;
  scopes: string[];
  maskedAccountNo?: string;
  providerUsername?: string;
}

export interface PaymentIdentifier {
  id: string;
  type: "UPI_ID" | "UPI_NUMBER" | "ACCOUNT_NUMBER" | "WALLET_ID";
  value: string; // e.g. "user@paytm" or "9876543210"
  accountHolderName: string;
  provider: string;
  isDefault: boolean;
  status: "ACTIVE" | "UNVERIFIED" | "SUSPENDED";
  metadata?: Record<string, string | number | boolean>;
}

export interface ProviderAccountDetails {
  accountId: string;
  providerId: string;
  accountHolderName: string;
  maskedAccountNo: string;
  currency: string;
  identifiers: PaymentIdentifier[];
  accountStatus: "ACTIVE" | "FROZEN" | "RESTRICTED";
  lastSyncedAt: number;
}

export interface ProviderTransaction {
  transactionId: string; // Provider transaction ID
  referenceNumber: string; // 12-digit UTR / Bank Reference
  amount: number;
  currency: string;
  direction: "CREDIT" | "DEBIT";
  status: "SUCCESS" | "PENDING" | "FAILED";
  timestamp: number;
  payerIdentifier?: string; // Masked or full UPI / Account
  payeeIdentifier?: string;
  note?: string;
  providerRawMetadata?: Record<string, unknown>;
}

export interface TransactionFilter {
  sinceTimestamp?: number;
  limit?: number;
  referenceNumber?: string;
  minAmount?: number;
  maxAmount?: number;
  direction?: "CREDIT" | "DEBIT";
}

/**
 * ProviderReadAdapter - Base contract for all authorized read-only provider integrations.
 */
export interface ProviderReadAdapter {
  readonly metadata: ProviderMetadata;

  /**
   * Initiate official OAuth/API authorization
   */
  getAuthorizationUrl(state: string, redirectUri: string): Promise<string>;

  /**
   * Exchange authorized code for read-only access tokens
   */
  exchangeAuthCode(code: string, redirectUri: string): Promise<ProviderAuthResult>;

  /**
   * Refresh read-only access token
   */
  refreshToken(refreshToken: string): Promise<ProviderAuthResult>;

  /**
   * Discover and fetch account details & payment identifiers
   */
  getAccount(accessToken: string): Promise<ProviderAccountDetails>;

  /**
   * Retrieve list of authorized UPI IDs & wallet identifiers
   */
  getPaymentIdentifiers(accessToken: string): Promise<PaymentIdentifier[]>;

  /**
   * Query authorized read-only transaction history
   */
  getTransactions(accessToken: string, filter?: TransactionFilter): Promise<ProviderTransaction[]>;

  /**
   * Query single transaction status by reference/UTR
   */
  getTransactionByReference(
    accessToken: string,
    referenceNumber: string,
  ): Promise<ProviderTransaction | null>;
}
