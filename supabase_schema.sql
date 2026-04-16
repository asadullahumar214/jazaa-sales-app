-- Execute this entire script in the Supabase Dashboard -> SQL Editor -> New Query

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id text PRIMARY KEY,
  role text NOT NULL,
  name text NOT NULL,
  password text NOT NULL,
  is_active boolean DEFAULT true,
  floor_check_enabled boolean DEFAULT true,
  stock_check_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
  id text PRIMARY KEY,
  name text NOT NULL,
  phone text,
  location text,
  type text NOT NULL,
  shop_type text DEFAULT 'Kiryana',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure new columns exist
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS ntn text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS strn text;

-- 3. Create Inventory Table
CREATE TABLE IF NOT EXISTS public.inventory (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text,
  rate numeric NOT NULL,
  rp numeric NOT NULL,
  product_type text NOT NULL, -- E (Exempt), N (Normal), R (Rice), TS (Recipe)
  stock integer DEFAULT 0,
  foc numeric DEFAULT 0,
  main_qty numeric DEFAULT 1,
  min_price_it numeric DEFAULT 0,
  min_price_reg numeric DEFAULT 0,
  min_price_ur numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure new columns exist
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS brand text;

-- 4. Create Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
  id boolean PRIMARY KEY DEFAULT true,
  config jsonb NOT NULL,
  CONSTRAINT settings_id_check CHECK (id)
);

-- Default Settings Insert
INSERT INTO public.settings (id, config) 
VALUES (true, '{
  "registered": { "advPct": 0.005, "e": 0, "n": 0.18, "r": 0.1, "ts": 0.18 },
  "it": { "advPct": 0.005, "e": 0, "n": 0.22, "r": 0.14, "ts": 0.18 },
  "ur": { "advPct": 0.025, "e": 0, "n": 0.22, "r": 0.14, "ts": 0.18 }
}'::jsonb)
ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config;

-- 5. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id text PRIMARY KEY,
  "bookerId" text,
  "customerId" text references public.customers(id),
  "customerName" text,
  status text NOT NULL DEFAULT 'confirmed',
  "totalValue" numeric NOT NULL,
  "invoiceFormat" text,
  items jsonb NOT NULL,
  cancel_reason text,
  date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action text NOT NULL,
  "userId" text,
  details text,
  reason text,
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Initial Users Seed
INSERT INTO public.users (id, role, name, password, is_active, floor_check_enabled, stock_check_enabled) VALUES 
('admin', 'admin', 'System Admin', 'admin123', true, true, true),
('shan', 'orderbooker', 'Shan', 'shan123', true, true, true)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- ROW LEVEL SECURITY (RLS) & POLICIES
-- ==========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies to avoid conflicts
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public Users Read" ON public.users;
    DROP POLICY IF EXISTS "Admin Users Full Access" ON public.users;
    DROP POLICY IF EXISTS "Public Customers Read" ON public.customers;
    DROP POLICY IF EXISTS "Public Customers Insert" ON public.customers;
    DROP POLICY IF EXISTS "Public Customers Update" ON public.customers;
    DROP POLICY IF EXISTS "Public Inventory Read" ON public.inventory;
    DROP POLICY IF EXISTS "Admin Inventory Update" ON public.inventory;
    DROP POLICY IF EXISTS "Public Settings Read" ON public.settings;
    DROP POLICY IF EXISTS "Admin Settings Update" ON public.settings;
    DROP POLICY IF EXISTS "Public Orders Read" ON public.orders;
    DROP POLICY IF EXISTS "Public Orders Insert" ON public.orders;
    DROP POLICY IF EXISTS "Public Orders Update" ON public.orders;
    DROP POLICY IF EXISTS "Audit Logs All" ON public.audit_logs;
END $$;

-- Policies
CREATE POLICY "Public Users Read" ON public.users FOR SELECT USING (true);
CREATE POLICY "Admin Users Full Access" ON public.users FOR ALL USING (true);

CREATE POLICY "Public Customers Read" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Public Customers Insert" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Customers Update" ON public.customers FOR UPDATE USING (true);

CREATE POLICY "Public Inventory Read" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "Admin Inventory Update" ON public.inventory FOR ALL USING (true);

CREATE POLICY "Public Settings Read" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Admin Settings Update" ON public.settings FOR ALL USING (true);

CREATE POLICY "Public Orders Read" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Public Orders Insert" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Orders Update" ON public.orders FOR UPDATE USING (true);

CREATE POLICY "Audit Logs All" ON public.audit_logs FOR ALL USING (true);

-- ==========================================
-- ATOMIC STOCK MANAGEMENT FUNCTIONS (RPC)
-- ==========================================

CREATE OR REPLACE FUNCTION deduct_stock(p_item_id TEXT, p_qty INT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.inventory 
  SET stock = stock - p_qty 
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION restore_stock(p_item_id TEXT, p_qty INT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.inventory 
  SET stock = stock + p_qty 
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql;

