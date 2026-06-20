-- WMS PostgreSQL Schema
-- Run this on Supabase SQL Editor

-- 1. Master Items
CREATE TABLE IF NOT EXISTS master_items (
  id TEXT PRIMARY KEY,
  item_code TEXT UNIQUE NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'PPE',
  subcategory TEXT DEFAULT '',
  unit_of_measure TEXT DEFAULT 'Piece',
  location TEXT DEFAULT '',
  tracker_group TEXT DEFAULT '',
  batch_controlled BOOLEAN DEFAULT FALSE,
  fefo_enabled BOOLEAN DEFAULT FALSE,
  minimum_stock NUMERIC DEFAULT 0,
  maximum_stock NUMERIC DEFAULT 0,
  reorder_level NUMERIC DEFAULT 0,
  standard_shelf_life NUMERIC DEFAULT 0,
  manufacturer TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  msds_required BOOLEAN DEFAULT FALSE,
  msds_link TEXT DEFAULT '',
  fifo_required BOOLEAN DEFAULT FALSE,
  remarks TEXT DEFAULT '',
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Employees
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  employee_id TEXT UNIQUE NOT NULL,
  employee_name TEXT NOT NULL,
  department TEXT DEFAULT '',
  position TEXT DEFAULT '',
  location TEXT DEFAULT '',
  hire_date TEXT DEFAULT '',
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Stock In Records
CREATE TABLE IF NOT EXISTS stock_in_records (
  id TEXT PRIMARY KEY,
  grn_number TEXT UNIQUE NOT NULL,
  receipt_date TEXT DEFAULT '',
  item_id TEXT DEFAULT '',
  item_code TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  quantity NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '',
  batch_id TEXT DEFAULT '',
  dom TEXT DEFAULT '',
  bbd TEXT DEFAULT '',
  expiry_date TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  warehouse_location TEXT DEFAULT '',
  purchase_order TEXT DEFAULT '',
  reference_number TEXT DEFAULT '',
  remarks TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Stock Out Records
CREATE TABLE IF NOT EXISTS stock_out_records (
  id TEXT PRIMARY KEY,
  issue_number TEXT UNIQUE NOT NULL,
  issue_date TEXT DEFAULT '',
  employee_id TEXT DEFAULT '',
  employee_name TEXT DEFAULT '',
  department TEXT DEFAULT '',
  item_id TEXT DEFAULT '',
  item_code TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  quantity NUMERIC DEFAULT 0,
  batch_id TEXT DEFAULT '',
  job_number TEXT DEFAULT '',
  remarks TEXT DEFAULT '',
  source TEXT DEFAULT '',
  request_number TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Batch Ledger
CREATE TABLE IF NOT EXISTS batch_ledger (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  item_id TEXT DEFAULT '',
  item_code TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  dom TEXT DEFAULT '',
  bbd TEXT DEFAULT '',
  expiry_date TEXT DEFAULT '',
  quantity_in NUMERIC DEFAULT 0,
  quantity_out NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Inventory Balances
CREATE TABLE IF NOT EXISTS inventory_balances (
  id TEXT PRIMARY KEY,
  item_id TEXT UNIQUE NOT NULL,
  item_code TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  total_quantity NUMERIC DEFAULT 0,
  available_quantity NUMERIC DEFAULT 0,
  reserved_quantity NUMERIC DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  job_number TEXT UNIQUE NOT NULL,
  job_name TEXT DEFAULT '',
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'Active',
  start_date TEXT DEFAULT '',
  end_date TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Job Materials
CREATE TABLE IF NOT EXISTS job_materials (
  id TEXT PRIMARY KEY,
  code TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  category TEXT DEFAULT '',
  quantity NUMERIC DEFAULT 0,
  job_number TEXT DEFAULT '',
  job_name TEXT DEFAULT '',
  status TEXT DEFAULT 'Pending',
  issued_to TEXT DEFAULT '',
  issued_date TEXT DEFAULT '',
  remarks TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Quarantine Materials
CREATE TABLE IF NOT EXISTS quarantine_materials (
  id TEXT PRIMARY KEY,
  code TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  description TEXT DEFAULT '',
  category TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  source TEXT DEFAULT '',
  received_date TEXT DEFAULT '',
  quarantine_date TEXT DEFAULT '',
  release_date TEXT DEFAULT '',
  quantity_in NUMERIC DEFAULT 0,
  quantity_out NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  location TEXT DEFAULT '',
  status TEXT DEFAULT 'Under Review',
  inspector TEXT DEFAULT '',
  inspection_result TEXT DEFAULT '',
  issued_to TEXT DEFAULT '',
  issued_date TEXT DEFAULT '',
  remarks TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Client Materials
CREATE TABLE IF NOT EXISTS client_materials (
  id TEXT PRIMARY KEY,
  code TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  description TEXT DEFAULT '',
  category TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  client_name TEXT DEFAULT '',
  project_number TEXT DEFAULT '',
  received_date TEXT DEFAULT '',
  expected_return_date TEXT DEFAULT '',
  quantity_in NUMERIC DEFAULT 0,
  quantity_out NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  location TEXT DEFAULT '',
  status TEXT DEFAULT 'In Stock',
  issued_to TEXT DEFAULT '',
  issued_date TEXT DEFAULT '',
  remarks TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Pending Requests
CREATE TABLE IF NOT EXISTS pending_requests (
  id TEXT PRIMARY KEY,
  request_number TEXT UNIQUE NOT NULL,
  employee_name TEXT DEFAULT '',
  department TEXT DEFAULT '',
  item_id TEXT DEFAULT '',
  item_code TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  tracker_group TEXT DEFAULT '',
  quantity NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '',
  job_number TEXT DEFAULT '',
  remarks TEXT DEFAULT '',
  status TEXT DEFAULT 'Pending',
  approved_by TEXT DEFAULT '',
  approved_at TEXT DEFAULT '',
  rejected_by TEXT DEFAULT '',
  rejected_at TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT DEFAULT '',
  role TEXT DEFAULT 'Viewer',
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Extra Users (for public form)
CREATE TABLE IF NOT EXISTS extra_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT DEFAULT 'Viewer',
  full_name TEXT DEFAULT ''
);

-- 14. Audit Trail
CREATE TABLE IF NOT EXISTS audit_trail (
  id TEXT PRIMARY KEY,
  action TEXT DEFAULT '',
  module TEXT DEFAULT '',
  record_id TEXT DEFAULT '',
  before_value TEXT DEFAULT '',
  after_value TEXT DEFAULT '',
  performed_by TEXT DEFAULT '',
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT DEFAULT ''
);

-- 15. Stock Adjustments
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id TEXT PRIMARY KEY,
  adjustment_number TEXT UNIQUE NOT NULL,
  adjustment_date TEXT DEFAULT '',
  item_id TEXT DEFAULT '',
  item_code TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  batch_id TEXT DEFAULT '',
  adjustment_type TEXT DEFAULT 'Reconciliation',
  quantity_before NUMERIC DEFAULT 0,
  quantity_adjusted NUMERIC DEFAULT 0,
  quantity_after NUMERIC DEFAULT 0,
  reason TEXT DEFAULT '',
  approved_by TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Settings (for sequences, categories, email, etc.)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_in_item ON stock_in_records(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_in_date ON stock_in_records(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_out_item ON stock_out_records(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_out_employee ON stock_out_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_stock_out_date ON stock_out_records(created_at);
CREATE INDEX IF NOT EXISTS idx_batch_ledger_item ON batch_ledger(item_id);
CREATE INDEX IF NOT EXISTS idx_batch_ledger_batch ON batch_ledger(batch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory_balances(item_id);
CREATE INDEX IF NOT EXISTS idx_job_materials_job ON job_materials(job_number);
CREATE INDEX IF NOT EXISTS idx_audit_trail_module ON audit_trail(module);
CREATE INDEX IF NOT EXISTS idx_audit_trail_date ON audit_trail(performed_at);
CREATE INDEX IF NOT EXISTS idx_stock_adj_item ON stock_adjustments(item_id);

-- Insert default settings
INSERT INTO settings (key, value) VALUES
  ('batch_sequence', '1'),
  ('grn_sequence', '1'),
  ('issue_sequence', '1'),
  ('adjustment_sequence', '1'),
  ('request_sequence', '1000'),
  ('stock_out_sequence', '0'),
  ('alert_email', ''),
  ('categories', '["PPE","Chemical","Spare Parts","Lubricant","Consumable","Stationery","Quality"]')
ON CONFLICT (key) DO NOTHING;
