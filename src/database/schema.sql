-- ============================================================================
-- CRAZYPAY CUSTOM P2P ENGINE - PRODUCTION POSTGRESQL DATABASE SCHEMA
-- ============================================================================
-- Complete schema for users, sessions, providers, trades, automated verification,
-- single payment identifier binding, and audit logging.
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mobile VARCHAR(15) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'MERCHANT', 'ADMIN')),
    kyc_level VARCHAR(20) NOT NULL DEFAULT 'TIER_1' CHECK (kyc_level IN ('TIER_1', 'TIER_2', 'TIER_3')),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    balance_inr NUMERIC(16, 2) NOT NULL DEFAULT 0.00 CHECK (balance_inr >= 0),
    balance_usdt NUMERIC(16, 4) NOT NULL DEFAULT 0.0000 CHECK (balance_usdt >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. USER SESSIONS & AUTH TOKENS
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token_hash VARCHAR(255) NOT NULL UNIQUE,
    refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
    device_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(access_token_hash);

-- 3. PAYMENT PROVIDER CONNECTIONS (Strict Read-Only OAuth/Tokens)
CREATE TABLE IF NOT EXISTS provider_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(100) NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT,
    scopes TEXT[] NOT NULL DEFAULT '{"read_accounts", "read_transactions"}',
    token_expires_at TIMESTAMPTZ NOT NULL,
    account_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_conn_user ON provider_connections(user_id);

-- 4. PAYMENT IDENTIFIERS (Single Active Binding Rule Enforced)
CREATE TABLE IF NOT EXISTS payment_identifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_connection_id UUID REFERENCES provider_connections(id) ON DELETE SET NULL,
    identifier_type VARCHAR(30) NOT NULL CHECK (identifier_type IN ('UPI_ID', 'UPI_NUMBER', 'ACCOUNT_NUMBER', 'WALLET_ID')),
    identifier_value VARCHAR(150) NOT NULL,
    account_holder_name VARCHAR(150) NOT NULL,
    is_active_binding BOOLEAN NOT NULL DEFAULT TRUE,
    binding_version INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'UNVERIFIED', 'SUSPENDED')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unbound_at TIMESTAMPTZ
);

-- Unique index ensuring ONLY ONE ACTIVE BINDING per user at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_binding_per_user 
ON payment_identifiers (user_id) 
WHERE is_active_binding = TRUE;

CREATE INDEX IF NOT EXISTS idx_payment_ident_value ON payment_identifiers(identifier_value);

-- 5. P2P TRADES (Complete Lifecycle State Machine)
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(30) NOT NULL UNIQUE,
    buyer_id UUID NOT NULL REFERENCES users(id),
    seller_id UUID NOT NULL REFERENCES users(id),
    asset VARCHAR(20) NOT NULL DEFAULT 'USDT',
    asset_amount NUMERIC(16, 4) NOT NULL CHECK (asset_amount > 0),
    fiat_currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    fiat_amount NUMERIC(16, 2) NOT NULL CHECK (fiat_amount > 0),
    exchange_rate NUMERIC(16, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'UPI',
    bound_payment_identifier VARCHAR(150) NOT NULL,
    seller_account_holder VARCHAR(150) NOT NULL,
    expected_payment_reference VARCHAR(50),
    submitted_utr VARCHAR(12),
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (
        status IN (
            'OPEN', 'MATCHED', 'PAYMENT_PENDING', 'PAYMENT_DETECTED',
            'VERIFICATION_PENDING', 'VERIFIED', 'COMPLETED',
            'CANCELLED', 'EXPIRED', 'FAILED', 'DISPUTED'
        )
    ),
    verification_attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    matched_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    payment_detected_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trades_buyer ON trades(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller ON trades(seller_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_utr ON trades(submitted_utr);

-- 6. TRADE AUDIT EVENTS
CREATE TABLE IF NOT EXISTS trade_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    from_status VARCHAR(30) NOT NULL,
    to_status VARCHAR(30) NOT NULL,
    triggered_by VARCHAR(100) NOT NULL,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_events_trade ON trade_events(trade_id);

-- 7. READ-ONLY PROVIDER TRANSACTIONS (Statement Cache)
CREATE TABLE IF NOT EXISTS provider_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_connection_id UUID REFERENCES provider_connections(id) ON DELETE SET NULL,
    provider_tx_id VARCHAR(150) NOT NULL,
    reference_number VARCHAR(50) NOT NULL, -- 12-Digit UTR
    amount NUMERIC(16, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
    status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
    timestamp TIMESTAMPTZ NOT NULL,
    payer_identifier VARCHAR(150),
    payee_identifier VARCHAR(150),
    note TEXT,
    is_consumed BOOLEAN NOT NULL DEFAULT FALSE,
    consumed_by_trade_id UUID REFERENCES trades(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prov_tx_unique_ref 
ON provider_transactions(reference_number, payee_identifier);

-- 8. AUTOMATED VERIFICATION ATTEMPTS & MATCHES
CREATE TABLE IF NOT EXISTS verification_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    submitted_utr VARCHAR(20) NOT NULL,
    verification_code VARCHAR(50) NOT NULL,
    is_successful BOOLEAN NOT NULL,
    failure_reason TEXT,
    matched_provider_tx_id UUID REFERENCES provider_transactions(id),
    amount_difference NUMERIC(16, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verif_trade ON verification_attempts(trade_id);

-- 9. IDEMPOTENCY KEYS
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    response_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 10. SYSTEM AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    changes JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
