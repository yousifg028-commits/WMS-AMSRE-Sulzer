export type TrackerGroup = 'PPE' | 'Stationery' | 'Job Material' | 'QC' | '';

export interface MasterItem {
  id: string;
  itemCode: string;
  itemName: string;
  category: string;
  subcategory: string;
  unitOfMeasure: string;
  location: string;
  trackerGroup: TrackerGroup;
  batchControlled: boolean;
  fefoEnabled: boolean;
  minimumStock: number;
  maximumStock: number;
  reorderLevel: number;
  standardShelfLife: number;
  manufacturer: string;
  supplier: string;
  msdsRequired: boolean;
  msdsLink: string;
  fifoRequired: boolean;
  remarks: string;
  status: 'Active' | 'Archived';
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  location: string;
  hireDate: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  updatedAt: string;
}

export interface StockInRecord {
  id: string;
  grnNumber: string;
  receiptDate: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  batchId: string;
  dom: string;
  bbd: string;
  expiryDate: string;
  supplier: string;
  warehouseLocation: string;
  purchaseOrder: string;
  referenceNumber: string;
  remarks: string;
  createdBy: string;
  createdAt: string;
}

export interface BatchLedgerEntry {
  id: string;
  batchId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  dom: string;
  bbd: string;
  expiryDate: string;
  quantityIn: number;
  quantityOut: number;
  balance: number;
  status: 'Active' | 'Near Expiry' | 'Expired' | 'Depleted';
  createdAt: string;
  updatedAt: string;
}

export interface StockOutRecord {
  id: string;
  issueNumber: string;
  issueDate: string;
  employeeId: string;
  employeeName: string;
  department: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  batchId: string;
  jobNumber: string;
  remarks: string;
  createdBy: string;
  createdAt: string;
}

export interface InventoryBalance {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  lastUpdated: string;
}

export interface StockAdjustment {
  id: string;
  adjustmentNumber: string;
  adjustmentDate: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  batchId: string;
  adjustmentType: 'Addition' | 'Deduction' | 'Reconciliation';
  quantityBefore: number;
  quantityAdjusted: number;
  quantityAfter: number;
  reason: string;
  approvedBy: string;
  createdBy: string;
  createdAt: string;
}

export interface ExpiryAlert {
  id: string;
  batchId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  expiryDate: string;
  quantity: number;
  status: 'Expired' | 'Near Expiry' | 'Warning';
  createdAt: string;
}

export interface AuditTrailEntry {
  id: string;
  action: string;
  module: string;
  recordId: string;
  beforeValue: string;
  afterValue: string;
  performedBy: string;
  performedAt: string;
  ipAddress: string;
}

export interface Job {
  id: string;
  jobNumber: string;
  jobName: string;
  description: string;
  status: 'Active' | 'On Hold' | 'Completed' | 'Cancelled' | 'Archived';
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockAlert {
  id: string;
  type: 'Low Stock' | 'Out of Stock' | 'Stock Issued' | 'Near Expiry' | 'Expired';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  currentQty: number;
  reorderLevel: number;
  read: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'Inactive' | 'Archived';
  createdAt: string;
}

export type UserRole = 'Administrator' | 'Warehouse Manager' | 'Warehouse Supervisor' | 'Storekeeper' | 'Viewer';

export interface JobMaterial {
  id: string;
  code: string;
  itemName: string;
  category: string;
  quantity: number;
  jobNumber: string;
  jobName: string;
  status: 'Pending' | 'Issued' | 'Cancelled';
  issuedTo: string;
  issuedDate: string;
  remarks: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}


export interface ClientMaterial {
  id: string;
  code: string;
  itemName: string;
  description: string;
  category: string;
  unit: string;
  clientName: string;
  projectNumber: string;
  receivedDate: string;
  expectedReturnDate: string;
  quantityIn: number;
  quantityOut: number;
  balance: number;
  location: string;
  status: 'In Stock' | 'Issued' | 'Returned' | 'Expired';
  issuedTo: string;
  issuedDate: string;
  remarks: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuarantineMaterial {
  id: string;
  code: string;
  itemName: string;
  description: string;
  category: string;
  unit: string;
  reason: string;
  source: string;
  receivedDate: string;
  quarantineDate: string;
  releaseDate: string;
  quantityIn: number;
  quantityOut: number;
  balance: number;
  location: string;
  status: 'Under Review' | 'Released' | 'Rejected' | 'Returned' | 'Disposed';
  inspector: string;
  inspectionResult: string;
  issuedTo: string;
  issuedDate: string;
  remarks: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  name: UserRole;
  permissions: Permission[];
}

export type Permission =
  | 'dashboard.view'
  | 'items.view' | 'items.create' | 'items.edit' | 'items.archive' | 'items.import' | 'items.export'
  | 'employees.view' | 'employees.create' | 'employees.edit'
  | 'stockin.view' | 'stockin.create'
  | 'stockout.view' | 'stockout.create'
  | 'batch.view'
  | 'inventory.view' | 'inventory.adjust' | 'inventory.count'
  | 'expiry.view'
  | 'reports.view' | 'reports.export'
  | 'audit.view'
  | 'users.view' | 'users.create' | 'users.edit'
  | 'settings.view' | 'settings.edit';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  'Administrator': [
    'dashboard.view',
    'items.view', 'items.create', 'items.edit', 'items.archive', 'items.import', 'items.export',
    'employees.view', 'employees.create', 'employees.edit',
    'stockin.view', 'stockin.create',
    'stockout.view', 'stockout.create',
    'batch.view',
    'inventory.view', 'inventory.adjust', 'inventory.count',
    'expiry.view',
    'reports.view', 'reports.export',
    'audit.view',
    'users.view', 'users.create', 'users.edit',
    'settings.view', 'settings.edit',
  ],
  'Warehouse Manager': [
    'dashboard.view',
    'items.view', 'items.create', 'items.edit', 'items.export',
    'employees.view', 'employees.create', 'employees.edit',
    'stockin.view', 'stockin.create',
    'stockout.view', 'stockout.create',
    'batch.view',
    'inventory.view', 'inventory.adjust', 'inventory.count',
    'expiry.view',
    'reports.view', 'reports.export',
    'audit.view',
  ],
  'Warehouse Supervisor': [
    'dashboard.view',
    'items.view',
    'employees.view',
    'stockin.view', 'stockin.create',
    'stockout.view', 'stockout.create',
    'batch.view',
    'inventory.view', 'inventory.count',
    'expiry.view',
    'reports.view',
  ],
  'Storekeeper': [
    'dashboard.view',
    'items.view',
    'employees.view',
    'stockin.view', 'stockin.create',
    'stockout.view', 'stockout.create',
    'batch.view',
    'inventory.view',
    'expiry.view',
  ],
  'Viewer': [
    'dashboard.view',
    'items.view',
    'employees.view',
    'stockin.view',
    'stockout.view',
    'batch.view',
    'inventory.view',
    'expiry.view',
    'reports.view',
  ],
};
