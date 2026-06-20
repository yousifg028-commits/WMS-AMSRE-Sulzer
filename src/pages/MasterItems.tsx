import { useState, useMemo, useRef } from 'react';
import { Plus, Edit2, Trash2, Printer, Search, Download, Upload, Archive, RotateCcw, ListPlus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useWMSStore } from '../store';
import type { MasterItem } from '../types';
import { Modal } from '../components/ui/Modal';
import { exportToCSV, exportToExcel } from '../utils/helpers';

const units = ['Box', 'Piece', 'Pair', 'Drum', 'Pack(100)', 'Bucket(20L)', 'Roll', 'Set', 'Kit', 'Ream', 'Box(100)', 'Pack(50)'];

const categoryPrefix: Record<string, string> = {
  'PPE': 'PPE', 'Chemical': 'CHE', 'Spare Parts': 'SPR',
  'Lubricant': 'LUB', 'Consumable': 'CON', 'Stationery': 'STA', 'Quality': 'QC',
};

function generateItemCode(category: string, existingItems: MasterItem[]): string {
  const prefixes: Record<string, string> = {
    Consumable: 'CON', Electrical: 'ELE', Housekeeping: 'HOU',
    HSE: 'HSE', PPE: 'PPE', Quality: 'QC',
  };
  const prefix = prefixes[category] || 'ITM';
  let maxNum = 0;
  for (const item of existingItems) {
    const match = item.itemCode.match(/^[A-Z]+-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
}

const emptyItem: Omit<MasterItem, 'id' | 'createdAt' | 'updatedAt'> = {
  itemCode: '', itemName: '', category: '', subcategory: '', unitOfMeasure: 'Piece',
  location: '', trackerGroup: '', batchControlled: true, fefoEnabled: false,
  minimumStock: 0, maximumStock: 0, reorderLevel: 0, standardShelfLife: 0,
  manufacturer: '', supplier: '', msdsRequired: false, msdsLink: '',
  fifoRequired: false, remarks: '', status: 'Active',
};

export default function MasterItems() {
  const { masterItems, addItem, updateItem, archiveItem, restoreItem, deleteItem, categories, addCategory, deleteCategory } = useWMSStore();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<MasterItem | null>(null);
  const [formData, setFormData] = useState(emptyItem);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState<'file' | 'paste'>('paste');
  const [importData, setImportData] = useState<Omit<MasterItem, 'id' | 'createdAt' | 'updatedAt'>[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const duplicateName = formData.itemName && masterItems.find(i => i.itemName.toLowerCase() === formData.itemName.toLowerCase() && i.id !== editItem?.id);

  const filtered = useMemo(() => {
    const statusFilter = activeTab === 'active' ? 'Active' : 'Archived';
    return masterItems.filter(item => {
      const matchStatus = item.status === statusFilter;
      const matchSearch = !search || item.itemCode.toLowerCase().includes(search.toLowerCase()) || item.itemName.toLowerCase().includes(search.toLowerCase());
      const matchCat = !filterCat || item.category === filterCat;
      return matchStatus && matchSearch && matchCat;
    }).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.itemCode.localeCompare(b.itemCode);
    });
  }, [masterItems, search, filterCat, activeTab]);

  const openCreate = () => {
    setEditItem(null);
    const code = generateItemCode(categories[0], masterItems);
    setFormData({ ...emptyItem, itemCode: code, category: categories[0] });
    setShowModal(true);
  };

  const openEdit = (item: MasterItem) => {
    setEditItem(item);
    setFormData({ ...item });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.itemCode || !formData.itemName) return;
    const duplicate = masterItems.find(i => i.itemName.toLowerCase() === formData.itemName.toLowerCase() && i.id !== editItem?.id);
    if (duplicate) {
      if (!window.confirm(`Item "${formData.itemName}" already exists (${duplicate.itemCode}). Do you want to create it anyway?`)) {
        return;
      }
    }
    if (editItem) { updateItem(editItem.id, formData); } else { addItem(formData); }
    setShowModal(false);
  };

  const handleDelete = (item: MasterItem) => {
    if (window.confirm(`Are you sure you want to permanently delete "${item.itemName}"?`)) {
      deleteItem(item.id);
    }
  };

  const handlePrint = (item: MasterItem) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Item Details - ${item.itemCode}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
        .logo { font-size: 12px; color: #666; margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        th { background: #f3f4f6; font-weight: bold; width: 200px; }
        @media print { body { padding: 10px; } }
      </style></head><body>
      <div class="logo">AMSER - Sulzer</div>
      <h1>Item Details</h1>
      <table>
        <tr><th>Item Code</th><td>${item.itemCode}</td></tr>
        <tr><th>Item Name</th><td>${item.itemName}</td></tr>
        <tr><th>Category</th><td>${item.category}</td></tr>
        <tr><th>Subcategory</th><td>${item.subcategory || '-'}</td></tr>
        <tr><th>Unit</th><td>${item.unitOfMeasure}</td></tr>
        <tr><th>Location</th><td>${item.location || '-'}</td></tr>
        <tr><th>Tracker Group</th><td>${item.trackerGroup || 'None'}</td></tr>
        <tr><th>Batch Controlled</th><td>${item.batchControlled ? 'Yes' : 'No'}</td></tr>
        <tr><th>FEFO Enabled</th><td>${item.fefoEnabled ? 'Yes' : 'No'}</td></tr>
        <tr><th>Min Stock</th><td>${item.minimumStock}</td></tr>
        <tr><th>Max Stock</th><td>${item.maximumStock}</td></tr>
        <tr><th>MSDS Required</th><td>${item.msdsRequired ? 'Yes' : 'No'}</td></tr>
        <tr><th>FIFO Required</th><td>${item.fifoRequired ? 'Yes' : 'No'}</td></tr>
        <tr><th>Remarks</th><td>${item.remarks || '-'}</td></tr>
        <tr><th>Status</th><td>${item.status}</td></tr>
      </table>
      <p style="margin-top: 20px; font-size: 11px; color: #999;">Printed on: ${new Date().toLocaleString()}</p>
      <script>window.onload = function() { window.print(); }</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const handleExport = (format: 'csv' | 'excel') => {
    const data = filtered.map(item => ({
      'Item Code': item.itemCode, 'Item Name': item.itemName, 'Category': item.category,
      'Subcategory': item.subcategory, 'Unit': item.unitOfMeasure, 'Location': item.location,
      'Tracker Group': item.trackerGroup || 'None', 'Batch Controlled': item.batchControlled ? 'Yes' : 'No',
      'FEFO': item.fefoEnabled ? 'Yes' : 'No', 'Min Stock': item.minimumStock, 'Max Stock': item.maximumStock,
      'Manufacturer': item.manufacturer, 'Supplier': item.supplier,
      'MSDS Required': item.msdsRequired ? 'Yes' : 'No', 'MSDS Link': item.msdsLink,
      'FIFO Required': item.fifoRequired ? 'Yes' : 'No', 'Remarks': item.remarks, 'Status': item.status,
    }));
    if (format === 'csv') exportToCSV(data, 'master-items');
    else exportToExcel(data, 'master-items');
    setShowExportMenu(false);
  };

  const downloadTemplate = () => {
    const headers = ['Item Name', 'Category', 'Subcategory', 'Unit', 'Location', 'Tracker Group', 'Batch Controlled', 'FEFO', 'Min Stock', 'Max Stock', 'Reorder Level', 'Shelf Life (days)', 'Manufacturer', 'Supplier', 'MSDS Required', 'FIFO Required', 'Remarks'];
    const example = ['Safety Helmet', 'PPE', 'Head Protection', 'Piece', 'A-03-01', 'PPE', 'Yes', 'No', '15', '150', '30', '1825', 'HeadGuard', 'SafetyFirst Ltd', 'No', 'No', ''];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Items');
    XLSX.writeFile(wb, 'items-import-template.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      if (!data) return;
      try {
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        if (rows.length === 0) {
          setImportData([]);
          setImportErrors(['File is empty or has no data rows']);
          return;
        }
        const headers = Object.keys(rows[0]);
        const errors: string[] = [];
        const imported: Omit<MasterItem, 'id' | 'createdAt' | 'updatedAt'>[] = [];

        const findCol = (patterns: RegExp[]) => {
          const idx = headers.findIndex(h => patterns.some(p => p.test(h)));
          return idx >= 0 ? idx : -1;
        };
        const colName = findCol([/^item\s*name/i, /^name$/i, /^product/i, /^item$/i, /^description/i, /^material/i, /^itemName/i]);
        const colCat = findCol([/^category$/i, /^cat$/i, /^type$/i, /^group$/i]);
        const colCode = findCol([/^item\s*code/i, /^code$/i, /^sku$/i, /^itemcode/i]);
        const colSub = findCol([/^subcategory/i, /^sub/i, /^subcat/i]);
        const colUnit = findCol([/^unit/i, /^uom$/i]);
        const colLoc = findCol([/^location$/i, /^loc$/i, /^warehouse$/i, /^rack$/i]);
        const colTracker = findCol([/^tracker/i]);
        const colBatch = findCol([/^batch/i]);
        const colFefo = findCol([/^fefo/i]);
        const colMin = findCol([/^min\s*(stock|qty|quantity)?$/i]);
        const colMax = findCol([/^max\s*(stock|qty|quantity)?$/i]);
        const colReorder = findCol([/^reorder/i]);
        const colShelf = findCol([/^shelf/i, /^life$/i, /^shelflife/i]);
        const colMfr = findCol([/^manufacturer/i, /^mfr$/i, /^brand/i]);
        const colSup = findCol([/^supplier$/i, /^vendor$/i]);
        const colMsds = findCol([/^msds/i]);
        const colFifo = findCol([/^fifo/i]);
        const colRem = findCol([/^remark/i, /^note$/i, /^comment/i]);

        if (colName < 0) { errors.push('Could not find "Item Name" column. Your columns: ' + headers.join(', ')); setImportData([]); setImportErrors(errors); return; }
        if (colCat < 0) { errors.push('Could not find "Category" column. Your columns: ' + headers.join(', ')); setImportData([]); setImportErrors(errors); return; }

        const getVal = (row: Record<string, any>, colIdx: number) => colIdx >= 0 ? String(row[headers[colIdx]] || '').trim() : '';
        const getNum = (row: Record<string, any>, colIdx: number) => parseInt(getVal(row, colIdx)) || 0;
        const getBool = (row: Record<string, any>, colIdx: number) => { const s = getVal(row, colIdx).toLowerCase(); return s === 'yes' || s === 'true' || s === '1'; };

        rows.forEach((row, i) => {
          const name = getVal(row, colName);
          if (!name) { errors.push(`Row ${i + 2}: Missing item name`); return; }
          const cat = getVal(row, colCat);
          if (!cat) { errors.push(`Row ${i + 2}: Missing category for "${name}"`); return; }
          if (!categories.includes(cat)) { errors.push(`Row ${i + 2}: Invalid category "${cat}" for "${name}" — must be: ${categories.join(', ')}`); return; }
          imported.push({
            itemCode: getVal(row, colCode),
            itemName: name, category: cat,
            subcategory: getVal(row, colSub),
            unitOfMeasure: getVal(row, colUnit) || 'Piece',
            location: getVal(row, colLoc),
            trackerGroup: (getVal(row, colTracker)) as '' | 'PPE' | 'Stationery' | 'Job Material' | 'QC',
            batchControlled: getBool(row, colBatch),
            fefoEnabled: getBool(row, colFefo),
            minimumStock: getNum(row, colMin),
            maximumStock: getNum(row, colMax),
            reorderLevel: getNum(row, colReorder),
            standardShelfLife: getNum(row, colShelf),
            manufacturer: getVal(row, colMfr),
            supplier: getVal(row, colSup),
            msdsRequired: getBool(row, colMsds),
            fifoRequired: getBool(row, colFifo),
            remarks: getVal(row, colRem),
            msdsLink: '', status: 'Active',
          });
        });
        setImportData(imported);
        setImportErrors(errors);
      } catch (err: any) {
        setImportData([]);
        setImportErrors(['Failed to parse file: ' + (err.message || 'Unknown error')]);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleImport = () => {
    importData.forEach(item => addItem(item));
    setShowImportModal(false);
    setImportData([]);
    setImportFileName('');
    setImportErrors([]);
    setPasteText('');
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(item => item.id)));
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedIds.size} item(s)?`)) return;
    selectedIds.forEach(id => deleteItem(id));
    setSelectedIds(new Set());
  };

  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (categories.includes(name)) { alert('Category already exists'); return; }
    addCategory(name);
    if (!categoryPrefix[name]) {
      categoryPrefix[name] = name.substring(0, 3).toUpperCase();
    }
    setNewCategoryName('');
  };

  const handleDeleteCategory = (cat: string) => {
    const inUse = masterItems.some(i => i.category === cat);
    if (inUse) { alert(`Cannot delete "${cat}" — it is used by ${masterItems.filter(i => i.category === cat).length} item(s).`); return; }
    if (!window.confirm(`Delete category "${cat}"?`)) return;
    deleteCategory(cat);
    delete categoryPrefix[cat];
  };

  const handlePaste = () => {
    if (!pasteText.trim()) { setImportErrors(['Nothing pasted']); return; }
    const lines = pasteText.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) { setImportErrors(['Need at least a header row + 1 data row']); return; }
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    const findCol = (patterns: RegExp[]) => headers.findIndex(h => patterns.some(p => p.test(h)));
    const colName = findCol([/^item\s*name/i, /^name$/i, /^product/i, /^item$/i, /^description/i, /^material/i]);
    const colCat = findCol([/^category$/i, /^cat$/i, /^type$/i, /^group$/i]);
    const colSub = findCol([/^subcategory/i, /^sub/i]);
    const colUnit = findCol([/^unit/i, /^uom$/i]);
    const colLoc = findCol([/^location$/i, /^loc$/i]);
    const colTracker = findCol([/^tracker/i]);
    const colRem = findCol([/^remark/i, /^note$/i]);
    if (colName < 0) { setImportData([]); setImportErrors(['Cannot find "Item Name" column. Headers found: ' + headers.join(' | ')]); return; }
    if (colCat < 0) { setImportData([]); setImportErrors(['Cannot find "Category" column. Headers found: ' + headers.join(' | ')]); return; }
    const getVal = (cols: string[], idx: number) => idx >= 0 ? (cols[idx] || '').trim() : '';
    const errors: string[] = [];
    const imported: Omit<MasterItem, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
      const name = getVal(cols, colName);
      if (!name) { errors.push(`Row ${i + 1}: Missing item name`); continue; }
      const cat = getVal(cols, colCat);
      if (!cat || !categories.includes(cat)) { errors.push(`Row ${i + 1}: Invalid category "${cat}" for "${name}"`); continue; }
      imported.push({
        itemCode: '', itemName: name, category: cat,
        subcategory: getVal(cols, colSub),
        unitOfMeasure: getVal(cols, colUnit) || 'Piece',
        location: getVal(cols, colLoc),
        trackerGroup: (getVal(cols, colTracker)) as '' | 'PPE' | 'Stationery' | 'Job Material' | 'QC',
        batchControlled: true, fefoEnabled: false,
        minimumStock: 0, maximumStock: 0, reorderLevel: 0, standardShelfLife: 0,
        manufacturer: '', supplier: '', msdsRequired: false, fifoRequired: false,
        remarks: getVal(cols, colRem), msdsLink: '', status: 'Active',
      });
    }
    setImportData(imported);
    setImportErrors(errors);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Items</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your inventory items catalog</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
              <Trash2 className="w-4 h-4" /> Delete ({selectedIds.size})
            </button>
          )}
          <button onClick={() => setShowCategoryModal(true)} className="btn-secondary flex items-center gap-2">
            <ListPlus className="w-4 h-4" /> Categories
          </button>
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" /> Export
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 w-36">
                <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">CSV</button>
                <button onClick={() => handleExport('excel')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Excel</button>
              </div>
            )}
          </div>
          <button onClick={() => setShowImportModal(true)} className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Active Items</button>
        <button onClick={() => setActiveTab('archived')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'archived' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Archived Items</button>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by code or name..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
          </div>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="select-field w-40">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-center w-10">
                  <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length} onChange={handleSelectAll} className="rounded border-gray-300" />
                </th>
                <th className="px-4 py-3 text-left">Item Code</th>
                <th className="px-4 py-3 text-left">Item Name</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Unit</th>
                <th className="px-4 py-3 text-center">Tracker Group</th>
                <th className="px-4 py-3 text-center">Batch</th>
                <th className="px-4 py-3 text-center">FEFO</th>
                <th className="px-4 py-3 text-left">Min</th>
                <th className="px-4 py-3 text-left">Max</th>
                <th className="px-4 py-3 text-center">MSDS</th>
                <th className="px-4 py-3 text-center">FIFO</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleSelectItem(item.id)} className="rounded border-gray-300" />
                  </td>
                  <td className="table-cell font-medium text-blue-600">{item.itemCode}</td>
                  <td className="table-cell">{item.itemName}</td>
                  <td className="table-cell">{item.category}</td>
                  <td className="table-cell">{item.location}</td>
                  <td className="table-cell">{item.unitOfMeasure}</td>
                  <td className="table-cell text-center">{item.trackerGroup ? <span className="badge-blue">{item.trackerGroup}</span> : <span className="badge-gray">-</span>}</td>
                  <td className="table-cell text-center">{item.batchControlled ? <span className="badge-blue">Yes</span> : <span className="badge-gray">No</span>}</td>
                  <td className="table-cell text-center">{item.fefoEnabled ? <span className="badge-green">Yes</span> : <span className="badge-gray">No</span>}</td>
                  <td className="table-cell">{item.minimumStock}</td>
                  <td className="table-cell">{item.maximumStock}</td>
                  <td className="table-cell text-center">{item.msdsRequired ? <span className="badge-red">Yes</span> : <span className="badge-gray">No</span>}</td>
                  <td className="table-cell text-center">{item.fifoRequired ? <span className="badge-green">Yes</span> : <span className="badge-gray">No</span>}</td>
                  <td className="table-cell text-center">
                    <span className={item.status === 'Active' ? 'badge-green' : 'badge-gray'}>{item.status}</span>
                  </td>
                  <td className="table-cell text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600" title="Edit"><Edit2 className="w-4 h-4" /></button>
                      {activeTab === 'active' ? (
                        <button onClick={() => archiveItem(item.id)} className="p-1.5 hover:bg-orange-50 rounded-lg text-orange-600" title="Archive"><Archive className="w-4 h-4" /></button>
                      ) : (
                        <button onClick={() => restoreItem(item.id)} className="p-1.5 hover:bg-yellow-50 rounded-lg text-yellow-600" title="Restore"><RotateCcw className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => handleDelete(item)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      <button onClick={() => handlePrint(item)} className="p-1.5 hover:bg-green-50 rounded-lg text-green-600" title="Print"><Printer className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={15} className="px-4 py-12 text-center text-gray-500">No items found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500">Showing {filtered.length} of {masterItems.length} items</div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Item' : 'Create Item'} maxWidth="max-w-3xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Item Code *</label>
            <input type="text" value={formData.itemCode} readOnly className="input-field bg-gray-100 cursor-not-allowed" placeholder="Auto-generated" />
          </div>
          <div>
            <label className="label-field">Item Name *</label>
            <input type="text" value={formData.itemName} onChange={(e) => setFormData({ ...formData, itemName: e.target.value })} className={`input-field ${duplicateName ? 'border-red-500' : ''}`} placeholder="Enter item name" />
            {duplicateName && <p className="text-red-500 text-xs mt-1">This item name already exists ({duplicateName.itemCode})</p>}
          </div>
          <div className="relative">
            <label className="label-field">Category</label>
            <input
              type="text"
              value={showCatDropdown ? catSearch : formData.category}
              onChange={(e) => { const v = e.target.value; setCatSearch(v); setFormData({ ...formData, category: v }); setShowCatDropdown(true); }}
              onFocus={() => { setCatSearch(''); setShowCatDropdown(true); }}
              className="input-field"
              placeholder="Type or select category"
            />
            {showCatDropdown && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {categories.filter(c => !catSearch || c.toLowerCase().includes(catSearch.toLowerCase())).map(c => (
                  <button key={c} type="button" onClick={() => {
                    if (editItem) { setFormData({ ...formData, category: c }); }
                    else { setFormData({ ...formData, category: c, itemCode: generateItemCode(c, masterItems) }); }
                    setShowCatDropdown(false); setCatSearch('');
                  }} className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${formData.category === c ? 'bg-blue-100 font-medium' : ''}`}>
                    {c}
                  </button>
                ))}
                {catSearch && !categories.includes(catSearch) && (
                  <button type="button" onClick={() => { addCategory(catSearch); if (!categoryPrefix[catSearch]) categoryPrefix[catSearch] = catSearch.substring(0, 3).toUpperCase(); setFormData({ ...formData, category: catSearch, ...(editItem ? {} : { itemCode: generateItemCode(catSearch, masterItems) }) }); setShowCatDropdown(false); setCatSearch(''); }}
                    className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 font-medium">
                    + Add "{catSearch}"
                  </button>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="label-field">Subcategory (Type)</label>
            <input type="text" value={formData.subcategory} onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Unit of Measure</label>
            <select value={formData.unitOfMeasure} onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })} className="select-field">
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Location</label>
            <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="input-field" placeholder="e.g. Warehouse A, Shelf 3" />
          </div>
          <div>
            <label className="label-field">Tracker Group</label>
            <select value={formData.trackerGroup} onChange={(e) => setFormData({ ...formData, trackerGroup: e.target.value as typeof formData.trackerGroup })} className="select-field">
              <option value="">None</option>
              <option value="PPE">PPE</option>
              <option value="Stationery">Stationery</option>
              <option value="Job Material">Job Material</option>
              <option value="QC">QC</option>
            </select>
          </div>
          <div>
            <label className="label-field">Standard Shelf Life (days)</label>
            <input type="number" value={formData.standardShelfLife} onChange={(e) => setFormData({ ...formData, standardShelfLife: +e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Minimum Stock</label>
            <input type="number" value={formData.minimumStock} onChange={(e) => setFormData({ ...formData, minimumStock: +e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Maximum Stock</label>
            <input type="number" value={formData.maximumStock} onChange={(e) => setFormData({ ...formData, maximumStock: +e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Reorder Level</label>
            <input type="number" value={formData.reorderLevel} onChange={(e) => setFormData({ ...formData, reorderLevel: +e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Manufacturer</label>
            <input type="text" value={formData.manufacturer} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Supplier</label>
            <input type="text" value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} className="input-field" />
          </div>
          <div className="col-span-2">
            <label className="label-field">Remarks</label>
            <input type="text" value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} className="input-field" placeholder="Any additional notes" />
          </div>
          <div className="col-span-2 flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formData.batchControlled} onChange={(e) => setFormData({ ...formData, batchControlled: e.target.checked })} className="rounded border-gray-300" />
              Batch Controlled
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formData.fefoEnabled} onChange={(e) => setFormData({ ...formData, fefoEnabled: e.target.checked })} className="rounded border-gray-300" />
              FEFO Enabled
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formData.msdsRequired} onChange={(e) => setFormData({ ...formData, msdsRequired: e.target.checked })} className="rounded border-gray-300" />
              MSDS Required
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formData.fifoRequired} onChange={(e) => setFormData({ ...formData, fifoRequired: e.target.checked })} className="rounded border-gray-300" />
              FIFO Required
            </label>
          </div>
          {formData.msdsRequired && (
            <div className="col-span-2">
              <label className="label-field">MSDS Link / Note</label>
              <input type="text" value={formData.msdsLink} onChange={(e) => setFormData({ ...formData, msdsLink: e.target.value })} className="input-field" placeholder="URL or note about MSDS document" />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn-primary">{editItem ? 'Update' : 'Create'}</button>
        </div>
      </Modal>

      <Modal isOpen={showImportModal} onClose={() => { setShowImportModal(false); setImportData([]); setImportFileName(''); setImportErrors([]); setPasteText(''); }} title="Bulk Import Items" maxWidth="max-w-3xl">
        <div className="space-y-4">
          <div className="flex gap-2 border-b border-gray-200 pb-0">
            <button onClick={() => setImportTab('paste')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${importTab === 'paste' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Paste from Excel</button>
            <button onClick={() => setImportTab('file')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${importTab === 'file' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Upload File</button>
          </div>

          {importTab === 'paste' && (
            <div className="space-y-3">
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-800 font-medium">How to use:</p>
                <ol className="text-xs text-green-700 mt-1 list-decimal ml-4 space-y-1">
                  <li>Open your Excel/Google Sheets</li>
                  <li>Select all data including the header row (the first row should have column names like: Item Name, Category...)</li>
                  <li>Copy <strong>Ctrl+C</strong></li>
                  <li>Paste below <strong>Ctrl+V</strong></li>
                  <li>Click <strong>Parse</strong> to preview</li>
                </ol>
                <p className="text-xs text-green-600 mt-2">Required columns: <strong>Item Name</strong> and <strong>Category</strong> (values: {categories.join(', ')}). Other columns are optional.</p>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); setImportData([]); setImportErrors([]); }}
                placeholder={"Paste your Excel data here...\n\nExample:\nItem Name\tCategory\tUnit\nSafety Helmet\tPPE\tPiece\nBall Bearing\tSpare Parts\tPiece"}
                className="w-full h-48 p-3 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button onClick={handlePaste} className="btn-primary text-sm">Parse</button>
            </div>
          )}

          {importTab === 'file' && (
            <div className="space-y-3">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800 font-medium">Supported: Excel (.xlsx, .xls) or CSV</p>
                <p className="text-xs text-blue-600 mt-1">Required: <strong>Item Name</strong> and <strong>Category</strong> columns.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={downloadTemplate} className="btn-secondary flex items-center gap-2 text-sm">
                  <Download className="w-4 h-4" /> Download Template
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="btn-primary flex items-center gap-2 text-sm">
                  <Upload className="w-4 h-4" /> Choose File
                </button>
                <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              </div>
              {importFileName && <p className="text-sm text-gray-600">File: <span className="font-medium">{importFileName}</span></p>}
            </div>
          )}

          {importErrors.length > 0 && (
            <div className="bg-red-50 rounded-lg p-3 max-h-32 overflow-y-auto">
              <p className="text-sm text-red-700 font-medium mb-1">Errors ({importErrors.length}):</p>
              {importErrors.map((err, i) => <p key={i} className="text-xs text-red-600">{err}</p>)}
            </div>
          )}
          {importData.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Preview ({importData.length} items):</p>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-left">Unit</th><th className="px-3 py-2 text-left">Tracker</th><th className="px-3 py-2 text-left">Location</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {importData.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{item.itemName}</td>
                        <td className="px-3 py-2"><span className="badge-blue">{item.category}</span></td>
                        <td className="px-3 py-2">{item.unitOfMeasure}</td>
                        <td className="px-3 py-2">{item.trackerGroup || '-'}</td>
                        <td className="px-3 py-2">{item.location || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
            <button onClick={() => { setShowImportModal(false); setImportData([]); setImportFileName(''); setImportErrors([]); setPasteText(''); }} className="btn-secondary">Cancel</button>
            <button onClick={handleImport} disabled={importData.length === 0} className="btn-primary disabled:opacity-50">
              Import {importData.length} Items
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showCategoryModal} onClose={() => { setShowCategoryModal(false); setNewCategoryName(''); }} title="Manage Categories" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()} className="input-field flex-1" placeholder="New category name" />
            <button onClick={handleAddCategory} className="btn-primary flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
          </div>
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
            {categories.map(cat => {
              const count = masterItems.filter(i => i.category === cat).length;
              return (
                <div key={cat} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{cat}</span>
                    <span className="text-xs text-gray-500 ml-2">({count} items)</span>
                  </div>
                  <button onClick={() => handleDeleteCategory(cat)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-600" title="Delete category"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end pt-2 border-t">
            <button onClick={() => { setShowCategoryModal(false); setNewCategoryName(''); }} className="btn-secondary">Close</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
