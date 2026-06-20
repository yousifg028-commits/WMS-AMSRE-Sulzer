// WMS Server - PostgreSQL Version
// Uses Supabase PostgreSQL as primary database
// Google Sheet as backup (dual write)

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// ===== DATABASE =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function dbQuery(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

async function dbRun(text, params) {
  const client = await pool.connect();
  try {
    await client.query(text, params);
  } finally {
    client.release();
  }
}

// ===== AUTH =====
const JWT_SECRET = process.env.JWT_SECRET || 'wms-secret-key-change-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '98765';

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }
  const token = auth.slice(7);
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [username, password] = decoded.split(':');
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid' });
    req.user = { username };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ===== LOGIN =====
app.post('/api/login', function(req, res) {
  const { username, password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = Buffer.from(`${username}:${password}`).toString('base64');
    res.json({ ok: true, token, user: { username, role: 'Administrator' } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// ===== FULL SYNC - POST (client pushes all data) =====
app.post('/api/full-sync', authMiddleware, async function(req, res) {
  try {
    const body = req.body;

    if (body.masterItems && body.masterItems.length >= 0) {
      if (body.masterItems.length === 0) {
        await dbRun('DELETE FROM master_items');
      } else {
        for (const item of body.masterItems) {
          await dbRun(`INSERT INTO master_items (id,item_code,item_name,category,subcategory,unit_of_measure,location,tracker_group,batch_controlled,fefo_enabled,minimum_stock,maximum_stock,reorder_level,standard_shelf_life,manufacturer,supplier,msds_required,msds_link,fifo_required,remarks,status,created_at,updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
            ON CONFLICT (id) DO UPDATE SET item_code=EXCLUDED.item_code,item_name=EXCLUDED.item_name,category=EXCLUDED.category,subcategory=EXCLUDED.subcategory,unit_of_measure=EXCLUDED.unit_of_measure,location=EXCLUDED.location,tracker_group=EXCLUDED.tracker_group,batch_controlled=EXCLUDED.batch_controlled,fefo_enabled=EXCLUDED.fefo_enabled,minimum_stock=EXCLUDED.minimum_stock,maximum_stock=EXCLUDED.maximum_stock,reorder_level=EXCLUDED.reorder_level,standard_shelf_life=EXCLUDED.standard_shelf_life,manufacturer=EXCLUDED.manufacturer,supplier=EXCLUDED.supplier,msds_required=EXCLUDED.msds_required,msds_link=EXCLUDED.msds_link,fifo_required=EXCLUDED.fifo_required,remarks=EXCLUDED.remarks,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`,
            [item.id,item.itemCode,item.itemName,item.category,item.subcategory,item.unitOfMeasure,item.location,item.trackerGroup,item.batchControlled,item.fefoEnabled,item.minimumStock,item.maximumStock,item.reorderLevel,item.standardShelfLife,item.manufacturer,item.supplier,item.msdsRequired,item.msdsLink,item.fifoRequired,item.remarks,item.status,item.createdAt,item.updatedAt]);
        }
      }
    }

    if (body.employees && body.employees.length >= 0) {
      if (body.employees.length === 0) {
        await dbRun('DELETE FROM employees');
      } else {
        for (const e of body.employees) {
          await dbRun(`INSERT INTO employees (id,employee_id,employee_name,department,position,location,hire_date,status,created_at,updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (id) DO UPDATE SET employee_id=EXCLUDED.employee_id,employee_name=EXCLUDED.employee_name,department=EXCLUDED.department,position=EXCLUDED.position,location=EXCLUDED.location,hire_date=EXCLUDED.hire_date,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`,
            [e.id,e.employeeId,e.employeeName,e.department,e.position,e.location,e.hireDate,e.status,e.createdAt,e.updatedAt]);
        }
      }
    }

    if (body.stockInRecords) {
      for (const s of body.stockInRecords) {
        await dbRun(`INSERT INTO stock_in_records (id,grn_number,receipt_date,item_id,item_code,item_name,quantity,unit,batch_id,dom,bbd,expiry_date,supplier,warehouse_location,purchase_order,reference_number,remarks,created_by,created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
          ON CONFLICT (id) DO NOTHING`,
          [s.id,s.grnNumber,s.receiptDate,s.itemId,s.itemCode,s.itemName,s.quantity,s.unit,s.batchId,s.dom,s.bbd,s.expiryDate,s.supplier,s.warehouseLocation,s.purchaseOrder,s.referenceNumber,s.remarks,s.createdBy,s.createdAt]);
      }
    }

    if (body.stockOutRecords) {
      for (const s of body.stockOutRecords) {
        await dbRun(`INSERT INTO stock_out_records (id,issue_number,issue_date,employee_id,employee_name,department,item_id,item_code,item_name,quantity,batch_id,job_number,remarks,source,request_number,created_by,created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          ON CONFLICT (id) DO NOTHING`,
          [s.id,s.issueNumber,s.issueDate,s.employeeId,s.employeeName,s.department,s.itemId,s.itemCode,s.itemName,s.quantity,s.batchId,s.jobNumber,s.remarks,s.source||'',s.requestNumber||'',s.createdBy,s.createdAt]);
      }
    }

    if (body.batchLedger) {
      for (const b of body.batchLedger) {
        await dbRun(`INSERT INTO batch_ledger (id,batch_id,item_id,item_code,item_name,dom,bbd,expiry_date,quantity_in,quantity_out,balance,status,created_at,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          ON CONFLICT (id) DO NOTHING`,
          [b.id,b.batchId,b.itemId,b.itemCode,b.itemName,b.dom,b.bbd,b.expiryDate,b.quantityIn,b.quantityOut,b.balance,b.status,b.createdAt,b.updatedAt]);
      }
    }

    if (body.inventoryBalances) {
      for (const ib of body.inventoryBalances) {
        await dbRun(`INSERT INTO inventory_balances (id,item_id,item_code,item_name,total_quantity,available_quantity,reserved_quantity,last_updated)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (item_id) DO UPDATE SET total_quantity=EXCLUDED.total_quantity,available_quantity=EXCLUDED.available_quantity,reserved_quantity=EXCLUDED.reserved_quantity,last_updated=EXCLUDED.last_updated`,
          [ib.id,ib.itemId,ib.itemCode,ib.itemName,ib.totalQuantity,ib.availableQuantity,ib.reservedQuantity,ib.lastUpdated]);
      }
    }

    if (body.jobs && body.jobs.length >= 0) {
      if (body.jobs.length === 0) {
        await dbRun('DELETE FROM jobs');
      } else {
        for (const j of body.jobs) {
          await dbRun(`INSERT INTO jobs (id,job_number,job_name,description,status,start_date,end_date,created_at,updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (id) DO UPDATE SET job_number=EXCLUDED.job_number,job_name=EXCLUDED.job_name,description=EXCLUDED.description,status=EXCLUDED.status,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,updated_at=EXCLUDED.updated_at`,
            [j.id,j.jobNumber,j.jobName,j.description,j.status,j.startDate,j.endDate,j.createdAt,j.updatedAt]);
        }
      }
    }

    if (body.jobMaterials && body.jobMaterials.length >= 0) {
      if (body.jobMaterials.length === 0) {
        await dbRun('DELETE FROM job_materials');
      } else {
        for (const jm of body.jobMaterials) {
          await dbRun(`INSERT INTO job_materials (id,code,item_name,category,quantity,job_number,job_name,status,issued_to,issued_date,remarks,created_by,created_at,updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code,item_name=EXCLUDED.item_name,category=EXCLUDED.category,quantity=EXCLUDED.quantity,job_number=EXCLUDED.job_number,job_name=EXCLUDED.job_name,status=EXCLUDED.status,issued_to=EXCLUDED.issued_to,issued_date=EXCLUDED.issued_date,remarks=EXCLUDED.remarks,updated_at=EXCLUDED.updated_at`,
            [jm.id,jm.code,jm.itemName,jm.category,jm.quantity,jm.jobNumber,jm.jobName,jm.status,jm.issuedTo,jm.issuedDate,jm.remarks,jm.createdBy,jm.createdAt,jm.updatedAt]);
        }
      }
    }

    if (body.quarantineMaterials && body.quarantineMaterials.length >= 0) {
      if (body.quarantineMaterials.length === 0) {
        await dbRun('DELETE FROM quarantine_materials');
      } else {
        for (const q of body.quarantineMaterials) {
          await dbRun(`INSERT INTO quarantine_materials (id,code,item_name,description,category,unit,reason,source,received_date,quarantine_date,release_date,quantity_in,quantity_out,balance,location,status,inspector,inspection_result,issued_to,issued_date,remarks,created_by,created_at,updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
            ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code,item_name=EXCLUDED.item_name,description=EXCLUDED.description,category=EXCLUDED.category,unit=EXCLUDED.unit,reason=EXCLUDED.reason,source=EXCLUDED.source,received_date=EXCLUDED.received_date,quarantine_date=EXCLUDED.quarantine_date,release_date=EXCLUDED.release_date,quantity_in=EXCLUDED.quantity_in,quantity_out=EXCLUDED.quantity_out,balance=EXCLUDED.balance,location=EXCLUDED.location,status=EXCLUDED.status,inspector=EXCLUDED.inspector,inspection_result=EXCLUDED.inspection_result,issued_to=EXCLUDED.issued_to,issued_date=EXCLUDED.issued_date,remarks=EXCLUDED.remarks,updated_at=EXCLUDED.updated_at`,
            [q.id,q.code,q.itemName,q.description,q.category,q.unit,q.reason,q.source,q.receivedDate,q.quarantineDate,q.releaseDate,q.quantityIn,q.quantityOut,q.balance,q.location,q.status,q.inspector,q.inspectionResult,q.issuedTo,q.issuedDate,q.remarks,q.createdBy,q.createdAt,q.updatedAt]);
        }
      }
    }

    if (body.clientMaterials && body.clientMaterials.length >= 0) {
      if (body.clientMaterials.length === 0) {
        await dbRun('DELETE FROM client_materials');
      } else {
        for (const c of body.clientMaterials) {
          await dbRun(`INSERT INTO client_materials (id,code,item_name,description,category,unit,client_name,project_number,received_date,expected_return_date,quantity_in,quantity_out,balance,location,status,issued_to,issued_date,remarks,created_by,created_at,updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
            ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code,item_name=EXCLUDED.item_name,description=EXCLUDED.description,category=EXCLUDED.category,unit=EXCLUDED.unit,client_name=EXCLUDED.client_name,project_number=EXCLUDED.project_number,received_date=EXCLUDED.received_date,expected_return_date=EXCLUDED.expected_return_date,quantity_in=EXCLUDED.quantity_in,quantity_out=EXCLUDED.quantity_out,balance=EXCLUDED.balance,location=EXCLUDED.location,status=EXCLUDED.status,issued_to=EXCLUDED.issued_to,issued_date=EXCLUDED.issued_date,remarks=EXCLUDED.remarks,updated_at=EXCLUDED.updated_at`,
            [c.id,c.code,c.itemName,c.description,c.category,c.unit,c.clientName,c.projectNumber,c.receivedDate,c.expectedReturnDate,c.quantityIn,c.quantityOut,c.balance,c.location,c.status,c.issuedTo,c.issuedDate,c.remarks,c.createdBy,c.createdAt,c.updatedAt]);
        }
      }
    }

    if (body.pendingRequests) {
      for (const pr of body.pendingRequests) {
        await dbRun(`INSERT INTO pending_requests (id,request_number,employee_name,department,item_id,item_code,item_name,tracker_group,quantity,unit,job_number,remarks,status,approved_by,approved_at,rejected_by,rejected_at,created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
          ON CONFLICT (id) DO NOTHING`,
          [pr.id,pr.requestNumber,pr.employeeName,pr.department,pr.itemId,pr.itemCode,pr.itemName,pr.trackerGroup,pr.quantity,pr.unit,pr.jobNumber,pr.remarks,pr.status,pr.approvedBy||'',pr.approvedAt||'',pr.rejectedBy||'',pr.rejectedAt||'',pr.createdAt]);
      }
    }

    if (body.users) {
      for (const u of body.users) {
        await dbRun(`INSERT INTO users (id,username,email,role,status,created_at)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (id) DO NOTHING`,
          [u.id,u.username,u.email,u.role,u.status,u.createdAt]);
      }
    }

    if (body.auditTrail) {
      for (const a of body.auditTrail) {
        await dbRun(`INSERT INTO audit_trail (id,action,module,record_id,before_value,after_value,performed_by,performed_at,ip_address)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (id) DO NOTHING`,
          [a.id,a.action,a.module,a.recordId,a.beforeValue,a.afterValue,a.performedBy,a.performedAt,a.ipAddress]);
      }
    }

    if (body.stockAdjustments) {
      for (const sa of body.stockAdjustments) {
        await dbRun(`INSERT INTO stock_adjustments (id,adjustment_number,adjustment_date,item_id,item_code,item_name,batch_id,adjustment_type,quantity_before,quantity_adjusted,quantity_after,reason,approved_by,created_by,created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          ON CONFLICT (id) DO NOTHING`,
          [sa.id,sa.adjustmentNumber,sa.adjustmentDate,sa.itemId,sa.itemCode,sa.itemName,sa.batchId,sa.adjustmentType,sa.quantityBefore,sa.quantityAdjusted,sa.quantityAfter,sa.reason,sa.approvedBy,sa.createdBy,sa.createdAt]);
      }
    }

    // Settings
    if (body.batchSequence !== undefined) await dbRun(`INSERT INTO settings (key,value) VALUES ('batch_sequence',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [String(body.batchSequence)]);
    if (body.grnSequence !== undefined) await dbRun(`INSERT INTO settings (key,value) VALUES ('grn_sequence',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [String(body.grnSequence)]);
    if (body.issueSequence !== undefined) await dbRun(`INSERT INTO settings (key,value) VALUES ('issue_sequence',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [String(body.issueSequence)]);
    if (body.adjustmentSequence !== undefined) await dbRun(`INSERT INTO settings (key,value) VALUES ('adjustment_sequence',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [String(body.adjustmentSequence)]);
    if (body.alertEmail !== undefined) await dbRun(`INSERT INTO settings (key,value) VALUES ('alert_email',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [body.alertEmail]);
    if (body.categories) await dbRun(`INSERT INTO settings (key,value) VALUES ('categories',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [JSON.stringify(body.categories)]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Full sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== FULL SYNC - GET (server sends all data to client) =====
app.get('/api/full-sync', authMiddleware, async function(req, res) {
  try {
    const [masterItems, employees, stockInRecords, stockOutRecords, batchLedger, inventoryBalances, jobs, jobMaterials, quarantineMaterials, clientMaterials, pendingRequests, users, auditTrail, stockAdjustments] = await Promise.all([
      dbQuery('SELECT * FROM master_items ORDER BY category, item_code'),
      dbQuery('SELECT * FROM employees ORDER BY id'),
      dbQuery('SELECT * FROM stock_in_records ORDER BY created_at DESC'),
      dbQuery('SELECT * FROM stock_out_records ORDER BY created_at DESC'),
      dbQuery('SELECT * FROM batch_ledger ORDER BY updated_at DESC'),
      dbQuery('SELECT * FROM inventory_balances ORDER BY item_code'),
      dbQuery('SELECT * FROM jobs ORDER BY created_at DESC'),
      dbQuery('SELECT * FROM job_materials ORDER BY created_at DESC'),
      dbQuery('SELECT * FROM quarantine_materials ORDER BY updated_at DESC'),
      dbQuery('SELECT * FROM client_materials ORDER BY updated_at DESC'),
      dbQuery('SELECT * FROM pending_requests ORDER BY created_at DESC'),
      dbQuery('SELECT * FROM users ORDER BY created_at'),
      dbQuery('SELECT * FROM audit_trail ORDER BY performed_at DESC LIMIT 500'),
      dbQuery('SELECT * FROM stock_adjustments ORDER BY created_at DESC')
    ]);

    const settings = {};
    const settingsRows = await dbQuery('SELECT * FROM settings');
    for (const row of settingsRows) {
      if (row.key === 'categories') {
        try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = []; }
      } else {
        settings[row.key] = Number(row.value) || row.value;
      }
    }

    function mapMasterItem(r) {
      return { id:r.id,itemCode:r.item_code,itemName:r.item_name,category:r.category,subcategory:r.subcategory,unitOfMeasure:r.unit_of_measure,location:r.location,trackerGroup:r.tracker_group,batchControlled:r.batch_controlled,fefoEnabled:r.fefo_enabled,minimumStock:Number(r.minimum_stock),maximumStock:Number(r.maximum_stock),reorderLevel:Number(r.reorder_level),standardShelfLife:Number(r.standard_shelf_life),manufacturer:r.manufacturer,supplier:r.supplier,msdsRequired:r.msds_required,msdsLink:r.msds_link,fifoRequired:r.fifo_required,remarks:r.remarks,status:r.status,createdAt:r.created_at,updatedAt:r.updated_at };
    }
    function mapEmployee(r) {
      return { id:r.id,employeeId:r.employee_id,employeeName:r.employee_name,department:r.department,position:r.position,location:r.location,hireDate:r.hire_date,status:r.status,createdAt:r.created_at,updatedAt:r.updated_at };
    }
    function mapStockIn(r) {
      return { id:r.id,grnNumber:r.grn_number,receiptDate:r.receipt_date,itemId:r.item_id,itemCode:r.item_code,itemName:r.item_name,quantity:Number(r.quantity),unit:r.unit,batchId:r.batch_id,dom:r.dom,bbd:r.bbd,expiryDate:r.expiry_date,supplier:r.supplier,warehouseLocation:r.warehouse_location,purchaseOrder:r.purchase_order,referenceNumber:r.reference_number,remarks:r.remarks,createdBy:r.created_by,createdAt:r.created_at };
    }
    function mapStockOut(r) {
      return { id:r.id,issueNumber:r.issue_number,issueDate:r.issue_date,employeeId:r.employee_id,employeeName:r.employee_name,department:r.department,itemId:r.item_id,itemCode:r.item_code,itemName:r.item_name,quantity:Number(r.quantity),batchId:r.batch_id,jobNumber:r.job_number,remarks:r.remarks,source:r.source,requestNumber:r.request_number,createdBy:r.created_by,createdAt:r.created_at };
    }
    function mapBatch(r) {
      return { id:r.id,batchId:r.batch_id,itemId:r.item_id,itemCode:r.item_code,itemName:r.item_name,dom:r.dom,bbd:r.bbd,expiryDate:r.expiry_date,quantityIn:Number(r.quantity_in),quantityOut:Number(r.quantity_out),balance:Number(r.balance),status:r.status,createdAt:r.created_at,updatedAt:r.updated_at };
    }
    function mapInvBal(r) {
      return { id:r.id,itemId:r.item_id,itemCode:r.item_code,itemName:r.item_name,totalQuantity:Number(r.total_quantity),availableQuantity:Number(r.available_quantity),reservedQuantity:Number(r.reserved_quantity),lastUpdated:r.last_updated };
    }
    function mapJob(r) {
      return { id:r.id,jobNumber:r.job_number,jobName:r.job_name,description:r.description,status:r.status,startDate:r.start_date,endDate:r.end_date,createdAt:r.created_at,updatedAt:r.updated_at };
    }
    function mapJobMat(r) {
      return { id:r.id,code:r.code,itemName:r.item_name,category:r.category,quantity:Number(r.quantity),jobNumber:r.job_number,jobName:r.job_name,status:r.status,issuedTo:r.issued_to,issuedDate:r.issued_date,remarks:r.remarks,createdBy:r.created_by,createdAt:r.created_at,updatedAt:r.updated_at };
    }
    function mapQuarantine(r) {
      return { id:r.id,code:r.code,itemName:r.item_name,description:r.description,category:r.category,unit:r.unit,reason:r.reason,source:r.source,receivedDate:r.received_date,quarantineDate:r.quarantine_date,releaseDate:r.release_date,quantityIn:Number(r.quantity_in),quantityOut:Number(r.quantity_out),balance:Number(r.balance),location:r.location,status:r.status,inspector:r.inspector,inspectionResult:r.inspection_result,issuedTo:r.issued_to,issuedDate:r.issued_date,remarks:r.remarks,createdBy:r.created_by,createdAt:r.created_at,updatedAt:r.updated_at };
    }
    function mapClientMat(r) {
      return { id:r.id,code:r.code,itemName:r.item_name,description:r.description,category:r.category,unit:r.unit,clientName:r.client_name,projectNumber:r.project_number,receivedDate:r.received_date,expectedReturnDate:r.expected_return_date,quantityIn:Number(r.quantity_in),quantityOut:Number(r.quantity_out),balance:Number(r.balance),location:r.location,status:r.status,issuedTo:r.issued_to,issuedDate:r.issued_date,remarks:r.remarks,createdBy:r.created_by,createdAt:r.created_at,updatedAt:r.updated_at };
    }
    function mapPendingReq(r) {
      return { id:r.id,requestNumber:r.request_number,employeeName:r.employee_name,department:r.department,itemId:r.item_id,itemCode:r.item_code,itemName:r.item_name,trackerGroup:r.tracker_group,quantity:Number(r.quantity),unit:r.unit,jobNumber:r.job_number,remarks:r.remarks,status:r.status,approvedBy:r.approved_by,approvedAt:r.approved_at,rejectedBy:r.rejected_by,rejectedAt:r.rejected_at,createdAt:r.created_at };
    }
    function mapUser(r) {
      return { id:r.id,username:r.username,email:r.email,role:r.role,status:r.status,createdAt:r.created_at };
    }
    function mapAudit(r) {
      return { id:r.id,action:r.action,module:r.module,recordId:r.record_id,beforeValue:r.before_value,afterValue:r.after_value,performedBy:r.performed_by,performedAt:r.performed_at,ipAddress:r.ip_address };
    }
    function mapStockAdj(r) {
      return { id:r.id,adjustmentNumber:r.adjustment_number,adjustmentDate:r.adjustment_date,itemId:r.item_id,itemCode:r.item_code,itemName:r.item_name,batchId:r.batch_id,adjustmentType:r.adjustment_type,quantityBefore:Number(r.quantity_before),quantityAdjusted:Number(r.quantity_adjusted),quantityAfter:Number(r.quantity_after),reason:r.reason,approvedBy:r.approved_by,createdBy:r.created_by,createdAt:r.created_at };
    }

    res.json({
      masterItems: masterItems.map(mapMasterItem),
      employees: employees.map(mapEmployee),
      stockInRecords: stockInRecords.map(mapStockIn),
      stockOutRecords: stockOutRecords.map(mapStockOut),
      batchLedger: batchLedger.map(mapBatch),
      inventoryBalances: inventoryBalances.map(mapInvBal),
      jobs: jobs.map(mapJob),
      jobMaterials: jobMaterials.map(mapJobMat),
      quarantineMaterials: quarantineMaterials.map(mapQuarantine),
      clientMaterials: clientMaterials.map(mapClientMat),
      pendingRequests: pendingRequests.map(mapPendingReq),
      users: users.map(mapUser),
      auditTrail: auditTrail.map(mapAudit),
      stockAdjustments: stockAdjustments.map(mapStockAdj),
      categories: settings.categories || ['PPE','Chemical','Spare Parts','Lubricant','Consumable','Stationery','Quality'],
      batchSequence: settings.batch_sequence || 1,
      grnSequence: settings.grn_sequence || 1,
      issueSequence: settings.issue_sequence || 1,
      adjustmentSequence: settings.adjustment_sequence || 1,
      alertEmail: settings.alert_email || ''
    });
  } catch (err) {
    console.error('Full sync GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== PUBLIC STOCK DATA (no auth needed) =====
app.get('/api/public/stock-data', async function(req, res) {
  try {
    const items = (await dbQuery("SELECT * FROM master_items WHERE status='Active'")).map(r => ({
      id:r.id, itemCode:r.item_code, itemName:r.item_name, unit:r.unit_of_measure, trackerGroup:r.tracker_group||''
    }));
    const employees = (await dbQuery("SELECT * FROM employees WHERE status='Active'")).map(r => ({
      id:r.id, employeeName:r.employee_name, department:r.department
    }));
    const jobs = (await dbQuery("SELECT * FROM jobs WHERE status='Active'")).map(r => ({
      id:r.id, jobNumber:r.job_number, jobName:r.job_name, description:r.description, status:r.status, startDate:r.start_date, endDate:r.end_date, createdAt:r.created_at, updatedAt:r.updated_at
    }));

    // Get batch balances for items
    for (const item of items) {
      const batches = await dbQuery('SELECT balance FROM batch_ledger WHERE item_id=$1', [item.id]);
      item.availableQty = batches.reduce((sum, b) => sum + Number(b.balance), 0);
    }

    res.json({ items, employees, jobs });
  } catch (err) {
    console.error('Public stock data error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== DIAGNOSTICS =====
app.get('/api/diag', async function(req, res) {
  try {
    const result = await dbQuery('SELECT NOW() as time, current_database() as db');
    res.json({
      ok: true,
      database: 'PostgreSQL',
      connected: true,
      serverTime: result[0].time,
      dbName: result[0].db,
      hasDatabaseUrl: !!process.env.DATABASE_URL
    });
  } catch (err) {
    res.json({ ok: false, error: err.message, hasDatabaseUrl: !!process.env.DATABASE_URL });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, async function() {
  console.log('  WMS Server (PostgreSQL) running on port ' + PORT);
  try {
    await dbQuery('SELECT 1');
    console.log('  Database: CONNECTED');
    const count = await dbQuery('SELECT COUNT(*) as c FROM master_items');
    console.log('  Master Items: ' + count[0].c);
    const empCount = await dbQuery('SELECT COUNT(*) as c FROM employees');
    console.log('  Employees: ' + empCount[0].c);
  } catch (err) {
    console.log('  Database: ERROR - ' + err.message);
  }
});
