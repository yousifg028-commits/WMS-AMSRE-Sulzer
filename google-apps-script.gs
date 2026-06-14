// =====================================================
// AMSER-Sulzer WMS - Google Apps Script
// Copy this code to: Google Sheet > Extensions > Apps Script
// Then: Deploy > New Deployment > Web App > Execute as: Me > Who has access: Anyone
// =====================================================

const SHEETS = {
  MasterItems: 'MasterItems',
  Employees: 'Employees',
  StockIn: 'StockIn',
  StockOut: 'StockOut',
  BatchLedger: 'BatchLedger',
  InventoryBalances: 'InventoryBalances',
  Jobs: 'Jobs',
  AuditTrail: 'AuditTrail',
  Users: 'Users',
};

const HEADERS = {
  MasterItems: ['id','itemCode','itemName','category','subcategory','unitOfMeasure','location','trackerGroup','batchControlled','fefoEnabled','minimumStock','maximumStock','reorderLevel','standardShelfLife','manufacturer','supplier','msdsRequired','msdsLink','fifoRequired','remarks','status','createdAt','updatedAt'],
  Employees: ['id','employeeId','employeeName','department','position','location','hireDate','status','createdAt','updatedAt'],
  StockIn: ['id','grnNumber','receiptDate','itemId','itemCode','itemName','quantity','unit','batchId','dom','bbd','expiryDate','supplier','warehouseLocation','remarks','createdBy','createdAt'],
  StockOut: ['id','issueNumber','issueDate','employeeId','employeeName','department','itemId','itemCode','itemName','quantity','batchId','jobNumber','remarks','createdBy','createdAt'],
  BatchLedger: ['id','batchId','itemId','itemCode','itemName','dom','bbd','expiryDate','quantityIn','quantityOut','balance','status','createdAt','updatedAt'],
  InventoryBalances: ['id','itemId','itemCode','itemName','totalQuantity','availableQuantity','reservedQuantity','lastUpdated'],
  Jobs: ['id','jobNumber','jobName','description','status','startDate','endDate','createdAt','updatedAt'],
  AuditTrail: ['id','action','module','recordId','beforeValue','afterValue','performedBy','performedAt','ipAddress'],
  Users: ['id','username','email','role','status','createdAt'],
};

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  const params = method === 'GET' ? (e.parameter || {}) : JSON.parse(e.postData.contents || '{}');
  const action = params.action;
  const sheetName = params.sheet;

  try {
    switch (action) {
      case 'getAll':
        return jsonResponse(getAllData(sheetName));
      case 'get':
        return jsonResponse(getRows(sheetName, params));
      case 'insert':
        return jsonResponse(insertRow(sheetName, params.data));
      case 'insertBatch':
        return jsonResponse(insertBatch(sheetName, params.data));
      case 'update':
        return jsonResponse(updateRow(sheetName, params.id, params.data));
      case 'delete':
        return jsonResponse(deleteRow(sheetName, params.id));
      case 'clear':
        return jsonResponse(clearSheet(sheetName));
      case 'replace':
        return jsonResponse(replaceAll(sheetName, params.data));
      case 'ping':
        return jsonResponse({ status: 'ok', sheets: Object.keys(SHEETS) });
      default:
        return jsonResponse({ error: 'Unknown action: ' + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function jsonResponse(data, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (HEADERS[name]) {
      sheet.appendRow(HEADERS[name]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function sheetToObjects_(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const results = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i].every(c => c === '')) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      let val = data[i][idx];
      if (typeof val === 'boolean') {
        val = val;
      } else if (val instanceof Date) {
        val = val.toISOString();
      } else if (typeof val === 'string' && (val === 'true' || val === 'false')) {
        val = val === 'true';
      }
      obj[h] = val;
    });
    results.push(obj);
  }
  return results;
}

function getAllData(sheetName) {
  if (!sheetName) {
    const all = {};
    Object.keys(SHEETS).forEach(name => {
      all[name] = sheetToObjects_(getSheet_(name));
    });
    return all;
  }
  return sheetToObjects_(getSheet_(sheetName));
}

function getRows(sheetName, params) {
  const rows = sheetToObjects_(getSheet_(sheetName));
  if (params.filter) {
    const filter = JSON.parse(params.filter);
    return rows.filter(row => Object.entries(filter).every(([k, v]) => row[k] === v));
  }
  return rows;
}

function insertRow(sheetName, data) {
  const sheet = getSheet_(sheetName);
  const headers = sheet.getFrozenRows() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  const row = headers.map(h => {
    const val = data[h];
    if (val === undefined || val === null) return '';
    if (typeof val === 'boolean') return val;
    return val;
  });
  sheet.appendRow(row);
  return { success: true, id: data.id };
}

function insertBatch(sheetName, dataArray) {
  const sheet = getSheet_(sheetName);
  if (!dataArray || dataArray.length === 0) return { success: true, count: 0 };
  const headers = sheet.getFrozenRows() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : Object.keys(HEADERS[sheetName] || {});
  const rows = dataArray.map(data => headers.map(h => {
    const val = data[h];
    if (val === undefined || val === null) return '';
    return val;
  }));
  if (rows.length > 0) {
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
  return { success: true, count: rows.length };
}

function updateRow(sheetName, id, data) {
  const sheet = getSheet_(sheetName);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');
  if (idCol < 0) return { success: false, error: 'No id column found' };
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) {
      headers.forEach((h, idx) => {
        if (data.hasOwnProperty(h)) {
          sheet.getRange(i + 1, idx + 1).setValue(data[h]);
        }
      });
      return { success: true, id };
    }
  }
  return { success: false, error: 'Row not found: ' + id };
}

function deleteRow(sheetName, id) {
  const sheet = getSheet_(sheetName);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');
  if (idCol < 0) return { success: false, error: 'No id column found' };
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true, id };
    }
  }
  return { success: false, error: 'Row not found: ' + id };
}

function clearSheet(sheetName) {
  const sheet = getSheet_(sheetName);
  if (sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }
  return { success: true };
}

function replaceAll(sheetName, dataArray) {
  clearSheet(sheetName);
  if (dataArray && dataArray.length > 0) {
    return insertBatch(sheetName, dataArray);
  }
  return { success: true, count: 0 };
}
