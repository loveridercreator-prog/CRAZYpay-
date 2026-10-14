/**
 * CRAZYPAY OFFICIAL PROVIDER REGISTRY
 * ============================================================================
 * Manages authorized read-only payment provider adapters across all Indian
 * UPI, merchant switches, and digital wallet platforms.
 * ============================================================================
 */

import { ProviderReadAdapter, ProviderMetadata } from "./types";
import { MockProviderAdapter } from "./mock-provider";
import { mobikwikProviderAdapter } from "./mobikwik-provider";

class ProviderRegistry {
  private adapters: Map<string, ProviderReadAdapter> = new Map();

  constructor() {
    this.registerDefaultAdapters();
  }

  private registerDefaultAdapters() {
    // 1. PhonePe & PhonePe Business
    this.register(new MockProviderAdapter("phonepe", "PhonePe Business UPI Switch"));
    this.register(new MockProviderAdapter("phonepe_business", "PhonePe Merchant Gateway"));

    // 2. Paytm & Paytm Business
    this.register(new MockProviderAdapter("paytm", "Paytm Payments Bank UPI Switch"));
    this.register(new MockProviderAdapter("paytm_business", "Paytm for Business Gateway"));

    // 3. Google Pay & Google Pay Business
    this.register(new MockProviderAdapter("googlepay", "Google Pay for Business UPI Gateway"));
    this.register(new MockProviderAdapter("gpay_business", "Google Pay Business Statement"));

    // 4. Freecharge & Freecharge Business
    this.register(new MockProviderAdapter("freecharge", "Freecharge UPI Switch"));
    this.register(new MockProviderAdapter("freecharge_business", "Freecharge Merchant Switch"));

    // 5. Super Money (Super.money UPI)
    this.register(new MockProviderAdapter("supermoney", "Super Money UPI & Credit Gateway"));

    // 6. MobiKwik & MobiKwik Business
    this.register(mobikwikProviderAdapter);
    this.register(new MockProviderAdapter("mobikwik_business", "MobiKwik Merchant Statement Sync"));

    // 7. BharatPe
    this.register(new MockProviderAdapter("bharatpe", "BharatPe Merchant QR Switch"));

    // 8. CRED UPI
    this.register(new MockProviderAdapter("cred", "CRED UPI Switch"));

    // 9. BHIM UPI National Core Switch
    this.register(new MockProviderAdapter("bhim", "NPCI National BHIM Switch"));

    // 10. Direct Core NetBanking UPI
    this.register(new MockProviderAdapter("directbank", "Core NetBanking UPI Linkage"));
  }

  register(adapter: ProviderReadAdapter) {
    this.adapters.set(adapter.metadata.id, adapter);
  }

  get(providerId: string): ProviderReadAdapter | undefined {
    return this.adapters.get(providerId);
  }

  listAvailableProviders(): ProviderMetadata[] {
    return Array.from(this.adapters.values()).map((a) => a.metadata);
  }
}

export const providerRegistry = new ProviderRegistry();
