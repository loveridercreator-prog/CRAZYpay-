import { z } from "zod";

/**
 * Strict 12-digit Indian Banking UTR / RRN validation schema
 */
export const UtrRegex = /^\d{12}$/;

/**
 * Authorized Indian DLT Transactional SMS Header Regex
 * Examples: AX-HDFCBK-T, BZ-SBIBNK-T, VK-ICICIB-T, AD-AXISBK-T, VM-KOTAKB-T
 */
export const BankHeaderRegex = /^[A-Z]{2}-[A-Za-z0-9]{5,8}-[T]$/;

/**
 * UUIDv4 Regex for strict order and idempotency ID validation
 */
export const UuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Zod Schema for Client Metadata
 */
export const ClientMetadataSchema = z.object({
  appVersion: z.string().min(1, "appVersion is required"),
  networkType: z.string().min(1, "networkType is required"),
  deviceId: z.string().optional(),
});

/**
 * Zod Schema for Inward UTR Notification Report from Android Client
 */
export const ReportUtrRequestSchema = z.object({
  orderId: z.string().regex(UuidRegex, "orderId must be a valid UUIDv4"),
  utr: z
    .string()
    .regex(UtrRegex, "UTR must be strictly 12 numeric digits")
    .refine((val) => !/^(\d)\1{11}$/.test(val), "UTR cannot be a repeating single digit")
    .refine(
      (val) => val !== "123456789012" && val !== "012345678901",
      "UTR cannot be a sequential test pattern",
    ),
  amount: z
    .number()
    .positive("Amount must be greater than zero")
    .max(10_000_000, "Amount exceeds maximum transaction limit"),
  currency: z.literal("INR"),
  senderHeader: z
    .string()
    .regex(
      BankHeaderRegex,
      "Sender header must be an authorized bank transactional header ending in -T",
    ),
  messageTimestamp: z
    .number()
    .int()
    .positive("Timestamp must be a positive epoch millisecond value"),
  clientMetadata: ClientMetadataSchema,
});

export type ReportUtrRequest = z.infer<typeof ReportUtrRequestSchema>;

/**
 * Response schema for settlement resolution
 */
export interface ReportUtrSuccessResponse {
  success: true;
  code: "PAYMENT_SETTLED" | "VERIFICATION_IN_PROGRESS";
  data: {
    orderId: string;
    status: "SETTLED" | "VERIFYING_UTR";
    utr: string;
    settledAmount: number;
    settledAt: string;
  };
}

export interface ReportUtrErrorResponse {
  success: false;
  code:
    | "INVALID_PAYLOAD"
    | "DUPLICATE_UTR_DETECTED"
    | "ORDER_NOT_FOUND"
    | "ORDER_EXPIRED"
    | "AMOUNT_MISMATCH"
    | "TEMPORAL_WINDOW_VIOLATION"
    | "INTERNAL_ERROR";
  error: {
    message: string;
    details?: unknown;
  };
}
