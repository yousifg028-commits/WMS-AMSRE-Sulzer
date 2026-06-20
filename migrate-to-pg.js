// Migration Script: Google Sheet → PostgreSQL
// Run: node migrate-to-pg.js

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbx7puscv5jMys7WmVLh4EOYSNRof4yOSoTuq7bhgnDqtR7e0X_VJqDZyglgj8NGUjWF8A/exec';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function dbRun(text, params) {
  const client = await pool.connect();
  try { await client.query(text, params); } finally { client.release(); }
}

async function fetchSheet() {
  const resp = await fetch(SHEET_URL + '?action=getAll');
  return resp.json();
}

async function migrate() {
  console.log('=== WMS Migration: Google Sheet → PostgreSQL ===');
  console.log('');

  // 1. Fetch from Google Sheet
  console.log('1. Fetching data from Google Sheet...');
  const data = await fetchSheet();
  console.log('   Employees:', data.Employees?.length || 0);
  console.log('   Jobs:', data.Jobs?.length || 0);
  console.log('   JobMaterials:', data.JobMaterials?.length || 0);
  console.log('   MasterItems:', data.MasterItems?.length || 0);
  console.log('   StockIn:', data.StockIn?.length || 0);
  console.log('   StockOut:', data.StockOut?.length || 0);
  console.log('   BatchLedger:', data.BatchLedger?.length || 0);
  console.log('   InventoryBalances:', data.InventoryBalances?.length || 0);
  console.log('');

  // 2. Test database connection
  console.log('2. Testing database connection...');
  try {
    await dbRun('SELECT 1');
    console.log('   ✓ Connected to PostgreSQL');
  } catch (err) {
    console.log('   ✗ Cannot connect:', err.message);
    process.exit(1);
  }
  console.log('');

  // 3. Migrate Employees
  if (data.Employees && data.Employees.length > 0) {
    console.log('3. Migrating Employees...');
    for (const e of data.Employees) {
      await dbRun(`INSERT INTO employees (id,employee_id,employee_name,department,position,location,hire_date,status,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO UPDATE SET employee_id=EXCLUDED.employee_id,employee_name=EXCLUDED.employee_name,department=EXCLUDED.department,position=EXCLUDED.position,location=EXCLUDED.location,hire_date=EXCLUDED.hire_date,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`,
        [e.id, e.employeeId, e.employeeName, e.department, e.position, e.location, e.hireDate, e.status, e.createdAt, e.updatedAt]);
    }
    console.log('   ✓ ' + data.Employees.length + ' employees migrated');
  }

  // 4. Migrate Jobs
  if (data.Jobs && data.Jobs.length > 0) {
    console.log('4. Migrating Jobs...');
    for (const j of data.Jobs) {
      await dbRun(`INSERT INTO jobs (id,job_number,job_name,description,status,start_date,end_date,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (id) DO UPDATE SET job_number=EXCLUDED.job_number,job_name=EXCLUDED.job_name,description=EXCLUDED.description,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`,
        [j.id, j.jobNumber, j.jobName, j.description, j.status, j.startDate, j.endDate, j.createdAt, j.updatedAt]);
    }
    console.log('   ✓ ' + data.Jobs.length + ' jobs migrated');
  }

  // 5. Migrate Job Materials
  if (data.JobMaterials && data.JobMaterials.length > 0) {
    console.log('5. Migrating Job Materials...');
    for (const jm of data.JobMaterials) {
      await dbRun(`INSERT INTO job_materials (id,code,item_name,category,quantity,job_number,job_name,status,issued_to,issued_date,remarks,created_by,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code,item_name=EXCLUDED.item_name,category=EXCLUDED.category,quantity=EXCLUDED.quantity,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`,
        [jm.id, jm.code, jm.itemName, jm.category, jm.quantity, jm.jobNumber, jm.jobName, jm.status, jm.issuedTo, jm.issuedDate, jm.remarks, jm.createdBy, jm.createdAt, jm.updatedAt]);
    }
    console.log('   ✓ ' + data.JobMaterials.length + ' job materials migrated');
  }

  // 6. Migrate Master Items
  if (data.MasterItems && data.MasterItems.length > 0) {
    console.log('6. Migrating Master Items...');
    for (const item of data.MasterItems) {
      await dbRun(`INSERT INTO master_items (id,item_code,item_name,category,subcategory,unit_of_measure,location,tracker_group,batch_controlled,fefo_enabled,minimum_stock,maximum_stock,reorder_level,standard_shelf_life,manufacturer,supplier,msds_required,msds_link,fifo_required,remarks,status,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
        ON CONFLICT (id) DO UPDATE SET item_code=EXCLUDED.item_code,item_name=EXCLUDED.item_name,category=EXCLUDED.category,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`,
        [item.id,item.itemCode,item.itemName,item.category,item.subcategory,item.unitOfMeasure,item.location,item.trackerGroup,item.batchControlled,item.fefoEnabled,item.minimumStock,item.maximumStock,item.reorderLevel,item.standardShelfLife,item.manufacturer,item.supplier,item.msdsRequired,item.msdsLink,item.fifoRequired,item.remarks,item.status,item.createdAt,item.updatedAt]);
    }
    console.log('   ✓ ' + data.MasterItems.length + ' master items migrated');
  }

  // 7. Migrate Stock In
  if (data.StockIn && data.StockIn.length > 0) {
    console.log('7. Migrating Stock In...');
    for (const s of data.StockIn) {
      await dbRun(`INSERT INTO stock_in_records (id,grn_number,receipt_date,item_id,item_code,item_name,quantity,unit,batch_id,dom,bbd,expiry_date,supplier,warehouse_location,purchase_order,reference_number,remarks,created_by,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        ON CONFLICT (id) DO NOTHING`,
        [s.id,s.grnNumber,s.receiptDate,s.itemId,s.itemCode,s.itemName,s.quantity,s.unit,s.batchId,s.dom,s.bbd,s.expiryDate,s.supplier,s.warehouseLocation,s.purchaseOrder,s.referenceNumber,s.remarks,s.createdBy,s.createdAt]);
    }
    console.log('   ✓ ' + data.StockIn.length + ' stock in records migrated');
  }

  // 8. Migrate Stock Out
  if (data.StockOut && data.StockOut.length > 0) {
    console.log('8. Migrating Stock Out...');
    for (const s of data.StockOut) {
      await dbRun(`INSERT INTO stock_out_records (id,issue_number,issue_date,employee_id,employee_name,department,item_id,item_code,item_name,quantity,batch_id,job_number,remarks,source,request_number,created_by,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (id) DO NOTHING`,
        [s.id,s.issueNumber,s.issueDate,s.employeeId,s.employeeName,s.department,s.itemId,s.itemCode,s.itemName,s.quantity,s.batchId,s.jobNumber,s.remarks,s.source||'',s.requestNumber||'',s.createdBy,s.createdAt]);
    }
    console.log('   ✓ ' + data.StockOut.length + ' stock out records migrated');
  }

  // 9. Migrate Batch Ledger
  if (data.BatchLedger && data.BatchLedger.length > 0) {
    console.log('9. Migrating Batch Ledger...');
    for (const b of data.BatchLedger) {
      await dbRun(`INSERT INTO batch_ledger (id,batch_id,item_id,item_code,item_name,dom,bbd,expiry_date,quantity_in,quantity_out,balance,status,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (id) DO NOTHING`,
        [b.id,b.batchId,b.itemId,b.itemCode,b.itemName,b.dom,b.bbd,b.expiryDate,b.quantityIn,b.quantityOut,b.balance,b.status,b.createdAt,b.updatedAt]);
    }
    console.log('   ✓ ' + data.BatchLedger.length + ' batch ledger entries migrated');
  }

  // 10. Migrate Inventory Balances
  if (data.InventoryBalances && data.InventoryBalances.length > 0) {
    console.log('10. Migrating Inventory Balances...');
    for (const ib of data.InventoryBalances) {
      await dbRun(`INSERT INTO inventory_balances (id,item_id,item_code,item_name,total_quantity,available_quantity,reserved_quantity,last_updated)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (item_id) DO UPDATE SET total_quantity=EXCLUDED.total_quantity,available_quantity=EXCLUDED.available_quantity,last_updated=EXCLUDED.last_updated`,
        [ib.id,ib.itemId,ib.itemCode,ib.itemName,ib.totalQuantity,ib.availableQuantity,ib.reservedQuantity,ib.lastUpdated]);
    }
    console.log('   ✓ ' + data.InventoryBalances.length + ' inventory balances migrated');
  }

  // 11. Verify
  console.log('');
  console.log('=== Verification ===');
  const tables = ['employees','jobs','job_materials','master_items','stock_in_records','stock_out_records','batch_ledger','inventory_balances'];
  for (const t of tables) {
    const result = await dbQuery('SELECT COUNT(*) as c FROM ' + t);
    console.log('   ' + t + ': ' + result[0].c + ' rows');
  }

  console.log('');
  console.log('✓ Migration complete!');
  await pool.end();
}

async function dbQuery(text, params) {
  const client = await pool.connect();
  try { return (await client.query(text, params)).rows; } finally { client.release(); }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
