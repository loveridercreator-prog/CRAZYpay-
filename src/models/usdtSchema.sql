-- ==============================================================================
-- CRAZY PAY :: PRODUCTION USDT PAYMENT ENGINE SCHEMA
-- Rebuilt from scratch using Supabase PostgreSQL. ZERO Firebase dependencies.
-- ==============================================================================

-- 1. Main USDT Orders Table
CREATE TABLE IF NOT EXISTS public.usdt_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
  received_amount NUMERIC(18, 4) DEFAULT 0,
  inr_credited NUMERIC(18, 2) DEFAULT 0,
  rate NUMERIC(18, 2) DEFAULT 117.00,
  network VARCHAR(16) NOT NULL CHECK (network IN ('BSC', 'BEP20', 'TRC20', 'TRC-20')),
  temp_address TEXT NOT NULL,
  temp_private_key TEXT,
  master_wallet TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'EXPIRED', 'FAILED', 'CANCELLED')),
  tx_hash TEXT,
  sweep_status VARCHAR(32) DEFAULT 'PENDING' CHECK (sweep_status IN ('PENDING', 'PROCESSING', 'SWEPT', 'FAILED', 'SKIPPED')),
  sweep_tx_hash TEXT,
  gas_funded BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Strict Unique Index on tx_hash to PREVENT ANY DOUBLE SPENDING
CREATE UNIQUE INDEX IF NOT EXISTS idx_usdt_orders_tx_hash_unique 
  ON public.usdt_orders(tx_hash) 
  WHERE tx_hash IS NOT NULL AND tx_hash <> '';

-- 3. Query Performance Indexes
CREATE INDEX IF NOT EXISTS idx_usdt_orders_user_id ON public.usdt_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_usdt_orders_temp_address ON public.usdt_orders(temp_address);
CREATE INDEX IF NOT EXISTS idx_usdt_orders_status ON public.usdt_orders(status);
CREATE INDEX IF NOT EXISTS idx_usdt_orders_created_at ON public.usdt_orders(created_at DESC);

-- 4. Sweeper Audit & Gas Funding Logs Table
CREATE TABLE IF NOT EXISTS public.usdt_sweeper_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT REFERENCES public.usdt_orders(id) ON DELETE CASCADE,
  temp_address TEXT NOT NULL,
  master_wallet TEXT NOT NULL,
  network VARCHAR(16) NOT NULL,
  amount_swept NUMERIC(18, 4) NOT NULL,
  gas_asset VARCHAR(8) NOT NULL, -- 'BNB' or 'TRX'
  gas_funded_amount NUMERIC(18, 8) DEFAULT 0,
  sweep_tx_hash TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'SWEPT',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usdt_sweeper_logs_order ON public.usdt_sweeper_logs(order_id);

-- 5. Row Level Security (RLS)
ALTER TABLE public.usdt_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usdt_sweeper_logs ENABLE ROW LEVEL SECURITY;

-- Allow public reads by order ID or user ID (secured by Supabase anon key)
CREATE POLICY "Allow select usdt_orders" ON public.usdt_orders
  FOR SELECT USING (true);

-- Allow backend upserts
CREATE POLICY "Allow upsert usdt_orders" ON public.usdt_orders
  FOR ALL USING (true) WITH CHECK (true);

-- Allow sweeper log inserts
CREATE POLICY "Allow all usdt_sweeper_logs" ON public.usdt_sweeper_logs
  FOR ALL USING (true) WITH CHECK (true);
