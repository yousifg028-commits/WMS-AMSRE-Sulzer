// Google Apps Script - Deploy as Web App
// This acts as a REST API for the WMS spreadsheet database

function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'getAll') {
    var result = {};
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var name = sheets[i].getName();
      var data = sheets[i].getDataRange().getValues();
      if (data.length > 0) {
        var headers = data[0];
        var rows = [];
        for (var r = 1; r < data.length; r++) {
          var row = {};
          for (var c = 0; c < headers.length; c++) {
            row[headers[c]] = data[r][c];
          }
          rows.push(row);
        }
        result[name] = rows;
      } else {
        result[name] = [];
      }
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'getSheet') {
    var sheetName = e.parameter.sheet;
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({error: 'Sheet not found'})).setMimeType(ContentService.MimeType.JSON);
    var data = sheet.getDataRange().getValues();
    if (data.length === 0) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    var headers = data[0];
    var rows = [];
    for (var r = 1; r < data.length; r++) {
      var row = {};
      for (var c = 0; c < headers.length; c++) {
        row[headers[c]] = data[r][c];
      }
      rows.push(row);
    }
    return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({error: 'Unknown action'})).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var action = body.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'saveSheet') {
    var sheetName = body.sheet;
    var data = body.data;
    var headers = body.headers;
    
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    sheet.clear();
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
    }
    if (data && data.length > 0) {
      for (var i = 0; i < data.length; i++) {
        var row = [];
        for (var h = 0; h < headers.length; h++) {
          row.push(data[i][headers[h]] !== undefined ? data[i][headers[h]] : '');
        }
        sheet.appendRow(row);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ok: true, sheet: sheetName, rows: (data ? data.length : 0)})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'saveAll') {
    var sheetsData = body.sheets;
    for (var sheetName in sheetsData) {
      var sd = sheetsData[sheetName];
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }
      sheet.clear();
      if (sd.headers && sd.headers.length > 0) {
        sheet.appendRow(sd.headers);
      }
      if (sd.rows && sd.rows.length > 0) {
        for (var i = 0; i < sd.rows.length; i++) {
          var row = [];
          for (var h = 0; h < sd.headers.length; h++) {
            row.push(sd.rows[i][sd.headers[h]] !== undefined ? sd.rows[i][sd.headers[h]] : '');
          }
          sheet.appendRow(row);
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ok: true, saved: Object.keys(sheetsData).length + ' sheets'})).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({error: 'Unknown action'})).setMimeType(ContentService.MimeType.JSON);
}
