-- Execute this entire script in the Supabase Dashboard -> SQL Editor -> New Query

-- 1. Create Users Table
CREATE TABLE public.users (
  id text PRIMARY KEY,
  role text NOT NULL,
  name text NOT NULL,
  password text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Customers Table
CREATE TABLE public.customers (
  id text PRIMARY KEY,
  name text NOT NULL,
  phone text,
  location text,
  type text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Inventory Table
CREATE TABLE public.inventory (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text,
  rate numeric NOT NULL,
  rp numeric NOT NULL,
  product_type text NOT NULL,
  stock integer DEFAULT 0,
  foc numeric DEFAULT 0,
  main_qty numeric DEFAULT 1,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Settings Table (Single row for global app config)
CREATE TABLE public.settings (
  id boolean PRIMARY KEY DEFAULT true,
  config jsonb NOT NULL,
  -- Ensures only one row exists
  CONSTRAINT settings_id_check CHECK (id)
);

-- Default Settings Insert
INSERT INTO public.settings (id, config) VALUES (true, '{
  "registered": { "advPct": 0.005, "e": 0.0, "n": 0.18, "r": 0.10, "ts": 0.18 },
  "it": { "advPct": 0.005, "e": 0.0, "n": 0.22, "r": 0.14, "ts": 0.18 },
  "ur": { "advPct": 0.025, "e": 0.0, "n": 0.22, "r": 0.14, "ts": 0.18 }
}'::jsonb);

-- 5. Create Orders Table
CREATE TABLE public.orders (
  id text PRIMARY KEY,
  "bookerId" text,
  "customerId" text references public.customers(id),
  "customerName" text,
  status text NOT NULL,
  "totalValue" numeric NOT NULL,
  "invoiceFormat" text,
  items jsonb NOT NULL, -- Storing cart as simple jsonb array
  cancel_reason text,
  date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create Audit Logs Table
CREATE TABLE public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action text NOT NULL,
  "userId" text references public.users(id),
  details text,
  reason text,
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Initial Users Seed
INSERT INTO public.users (id, role, name, password, is_active) VALUES 
('admin', 'admin', 'System Admin', 'admin123', true),
('shan', 'orderbooker', 'Shan', 'shan123', true);


-- Disable Row Level Security (RLS) entirely to allow frontend anonymous connectivity for the prototype
-- IMPORTANT: In a real production environment, you should secure this later!
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
