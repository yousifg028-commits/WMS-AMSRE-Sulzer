import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  MasterItem, Employee, StockInRecord, BatchLedgerEntry,
  StockOutRecord, InventoryBalance, StockAdjustment,
  ExpiryAlert, AuditTrailEntry, User, Permission, Job, StockAlert,
  ClientMaterial, QuarantineMaterial, JobMaterial,
} from '../types';
import { generateId, generateBatchId, generateGRN, generateIssueNumber, generateAdjustmentNumber } from '../utils/helpers';
import { allocateFEFO } from '../utils/fefo';
import { allocateFIFO } from '../utils/fifo';

interface WMSState {
  masterItems: MasterItem[];
  employees: Employee[];
  stockInRecords: StockInRecord[];
  batchLedger: BatchLedgerEntry[];
  stockOutRecords: StockOutRecord[];
  inventoryBalances: InventoryBalance[];
  stockAdjustments: StockAdjustment[];
  expiryAlerts: ExpiryAlert[];
  auditTrail: AuditTrailEntry[];
  users: User[];
  currentUser: User;
  jobs: Job[];
  stockAlerts: StockAlert[];
  alertEmail: string;
  quarantineMaterials: QuarantineMaterial[];
  clientMaterials: ClientMaterial[];
  jobMaterials: JobMaterial[];
  categories: string[];

  batchSequence: number;
  grnSequence: number;
  issueSequence: number;
  adjustmentSequence: number;

  addItem: (item: Omit<MasterItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateItem: (id: string, updates: Partial<MasterItem>) => void;
  archiveItem: (id: string) => void;
  restoreItem: (id: string) => void;
  deleteItem: (id: string) => void;

  addEmployee: (emp: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;

  createStockIn: (record: Omit<StockInRecord, 'id' | 'grnNumber' | 'batchId' | 'createdAt'>) => string;
  deleteStockIn: (id: string) => void;
  updateStockIn: (id: string, updates: Partial<StockInRecord>) => void;
  createStockOut: (record: Omit<StockOutRecord, 'id' | 'issueNumber' | 'createdAt' | 'batchId'>) => string | null;
  deleteStockOut: (id: string) => void;
  updateStockOut: (id: string, updates: Partial<StockOutRecord>) => void;
  createStockAdjustment: (adj: Omit<StockAdjustment, 'id' | 'adjustmentNumber' | 'createdAt'>) => void;
  applyServerStockOut: (record: StockOutRecord) => void;

  addAuditEntry: (entry: Omit<AuditTrailEntry, 'id' | 'performedAt' | 'ipAddress'>) => void;
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  setCurrentUser: (user: User) => void;
  hasPermission: (perm: Permission) => boolean;

  addJob: (job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  archiveJob: (id: string) => void;
  restoreJob: (id: string) => void;
  deleteJob: (id: string) => void;

  addAlert: (alert: Omit<StockAlert, 'id' | 'createdAt'>) => void;
  markAlertRead: (id: string) => void;
  markAllAlertsRead: () => void;
  setAlertEmail: (email: string) => void;
  getUnreadAlertCount: () => number;

  addCategory: (category: string) => void;
  deleteCategory: (category: string) => void;

  addQuarantineMaterial: (item: Omit<QuarantineMaterial, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateQuarantineMaterial: (id: string, updates: Partial<QuarantineMaterial>) => void;
  deleteQuarantineMaterial: (id: string) => void;
  issueQuarantineMaterial: (id: string, qty: number, issuedTo: string, issuedDate: string, source: string, jobNumber: string, remarks: string) => void;
  releaseQuarantineMaterial: (id: string, status: QuarantineMaterial['status'], inspectionResult: string, releaseDate: string, issuedTo: string, remarks: string) => void;

  addClientMaterial: (item: Omit<ClientMaterial, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateClientMaterial: (id: string, updates: Partial<ClientMaterial>) => void;
  deleteClientMaterial: (id: string) => void;
  issueClientMaterial: (id: string, qty: number, issuedTo: string, issuedDate: string, source: string, jobNumber: string, remarks: string) => void;
  returnClientMaterial: (id: string, qty: number) => void;

  addJobMaterial: (item: Omit<JobMaterial, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateJobMaterial: (id: string, updates: Partial<JobMaterial>) => void;
  deleteJobMaterial: (id: string) => void;
  issueJobMaterial: (id: string, qty: number, issuedTo: string, issuedDate: string, remarks: string) => string | null;

  getStockInByItem: (itemId: string) => StockInRecord[];
  getBatchesByItem: (itemId: string) => BatchLedgerEntry[];
  getStockOutByEmployee: (empId: string) => StockOutRecord[];
  getEmployeePPEHistory: (empId: string) => StockOutRecord[];
}

const mockMasterItems: MasterItem[] = [
  { id: '1', itemCode: 'PPE-GLV-001', itemName: 'Nitrile Gloves (L)', category: 'PPE', subcategory: 'Hand Protection', unitOfMeasure: 'Box', location: 'A-01-01', trackerGroup: 'PPE', batchControlled: true, fefoEnabled: true, minimumStock: 50, maximumStock: 500, reorderLevel: 100, standardShelfLife: 1095, manufacturer: 'SafeHand Co', supplier: 'SafetyFirst Ltd', msdsRequired: false, msdsLink: '', fifoRequired: false, remarks: '', status: 'Active', createdAt: '2025-01-15', updatedAt: '2025-01-15' },
  { id: '2', itemCode: 'PPE-MSK-002', itemName: 'N95 Respirator Mask', category: 'PPE', subcategory: 'Respiratory', unitOfMeasure: 'Box', location: 'A-01-02', trackerGroup: 'PPE', batchControlled: true, fefoEnabled: true, minimumStock: 30, maximumStock: 300, reorderLevel: 60, standardShelfLife: 730, manufacturer: 'AirSafe', supplier: 'SafetyFirst Ltd', msdsRequired: false, msdsLink: '', fifoRequired: false, remarks: '', status: 'Active', createdAt: '2025-01-15', updatedAt: '2025-01-15' },
  { id: '3', itemCode: 'PPE-EST-003', itemName: 'Safety Glasses', category: 'PPE', subcategory: 'Eye Protection', unitOfMeasure: 'Piece', location: 'A-02-01', trackerGroup: 'PPE', batchControlled: true, fefoEnabled: false, minimumStock: 20, maximumStock: 200, reorderLevel: 40, standardShelfLife: 1825, manufacturer: 'ClearView', supplier: 'ProtectAll Inc', msdsRequired: false, msdsLink: '', fifoRequired: false, remarks: '', status: 'Active', createdAt: '2025-01-15', updatedAt: '2025-01-15' },
  { id: '4', itemCode: 'PPE-BOT-004', itemName: 'Steel Toe Boots', category: 'PPE', subcategory: 'Foot Protection', unitOfMeasure: 'Pair', location: 'A-05-01', trackerGroup: 'PPE', batchControlled: true, fefoEnabled: false, minimumStock: 10, maximumStock: 100, reorderLevel: 20, standardShelfLife: 1095, manufacturer: 'IronStep', supplier: 'ProtectAll Inc', msdsRequired: false, msdsLink: '', fifoRequired: false, remarks: '', status: 'Active', createdAt: '2025-01-15', updatedAt: '2025-01-15' },
  { id: '5', itemCode: 'CHE-CLN-005', itemName: 'Industrial Cleaner 5L', category: 'Chemical', subcategory: 'Cleaning', unitOfMeasure: 'Drum', location: 'C-02-01', trackerGroup: '', batchControlled: true, fefoEnabled: true, minimumStock: 10, maximumStock: 100, reorderLevel: 25, standardShelfLife: 545, manufacturer: 'CleanPro', supplier: 'ChemSupply Co', msdsRequired: true, msdsLink: '', fifoRequired: true, remarks: '', status: 'Active', createdAt: '2025-02-01', updatedAt: '2025-02-01' },
  { id: '6', itemCode: 'SPR-BLT-006', itemName: 'M8 Hex Bolt M12x50', category: 'Spare Parts', subcategory: 'Fasteners', unitOfMeasure: 'Pack(100)', location: 'B-03-01', trackerGroup: '', batchControlled: false, fefoEnabled: false, minimumStock: 20, maximumStock: 200, reorderLevel: 50, standardShelfLife: 0, manufacturer: 'BoltWorks', supplier: 'Industrial Parts Ltd', msdsRequired: false, msdsLink: '', fifoRequired: false, remarks: '', status: 'Active', createdAt: '2025-02-10', updatedAt: '2025-02-10' },
  { id: '7', itemCode: 'PPE-HLM-007', itemName: 'Hard Hat (White)', category: 'PPE', subcategory: 'Head Protection', unitOfMeasure: 'Piece', location: 'A-03-01', trackerGroup: 'PPE', batchControlled: true, fefoEnabled: false, minimumStock: 15, maximumStock: 150, reorderLevel: 30, standardShelfLife: 1825, manufacturer: 'HeadGuard', supplier: 'SafetyFirst Ltd', msdsRequired: false, msdsLink: '', fifoRequired: false, remarks: '', status: 'Active', createdAt: '2025-02-15', updatedAt: '2025-02-15' },
  { id: '8', itemCode: 'PPE-HNS-008', itemName: 'Hi-Vis Safety Vest', category: 'PPE', subcategory: 'Body Protection', unitOfMeasure: 'Piece', location: 'A-04-01', trackerGroup: 'PPE', batchControlled: true, fefoEnabled: false, minimumStock: 20, maximumStock: 200, reorderLevel: 40, standardShelfLife: 1095, manufacturer: 'VisSafe', supplier: 'SafetyFirst Ltd', msdsRequired: false, msdsLink: '', fifoRequired: false, remarks: '', status: 'Active', createdAt: '2025-03-01', updatedAt: '2025-03-01' },
  { id: '9', itemCode: 'LUB-GRS-009', itemName: 'Multi-Purpose Grease', category: 'Lubricant', subcategory: 'Grease', unitOfMeasure: 'Bucket(20L)', location: 'C-01-01', trackerGroup: '', batchControlled: true, fefoEnabled: true, minimumStock: 5, maximumStock: 50, reorderLevel: 10, standardShelfLife: 1095, manufacturer: 'LubeMax', supplier: 'ChemSupply Co', msdsRequired: true, msdsLink: '', fifoRequired: true, remarks: '', status: 'Active', createdAt: '2025-03-10', updatedAt: '2025-03-10' },
  { id: '10', itemCode: 'SPR-BRG-010', itemName: 'Ball Bearing 6205', category: 'Spare Parts', subcategory: 'Bearings', unitOfMeasure: 'Piece', location: 'B-04-01', trackerGroup: '', batchControlled: true, fefoEnabled: false, minimumStock: 10, maximumStock: 100, reorderLevel: 25, standardShelfLife: 0, manufacturer: 'BearingPro', supplier: 'Industrial Parts Ltd', msdsRequired: false, msdsLink: '', fifoRequired: false, remarks: '', status: 'Active', createdAt: '2025-03-15', updatedAt: '2025-03-15' },
  { id: '11', itemCode: 'STA-PEN-001', itemName: 'Blue Ballpoint Pen', category: 'Stationery', subcategory: 'Writing', unitOfMeasure: 'Pack(50)', location: 'D-01-01', trackerGroup: 'Stationery', batchControlled: false, fefoEnabled: false, minimumStock: 10, maximumStock: 100, reorderLevel: 20, standardShelfLife: 0, manufacturer: 'WriteRight', supplier: 'Office Supply Co', msdsRequired: false, msdsLink: '', fifoRequired: false, remarks: '', status: 'Active', createdAt: '2025-04-01', updatedAt: '2025-04-01' },
  { id: '12', itemCode: 'STA-PPR-002', itemName: 'A4 Copy Paper (Ream)', category: 'Stationery', subcategory: 'Paper', unitOfMeasure: 'Ream', location: 'D-01-02', trackerGroup: 'Stationery', batchControlled: false, fefoEnabled: false, minimumStock: 20, maximumStock: 200, reorderLevel: 50, standardShelfLife: 0, manufacturer: 'PaperPlus', supplier: 'Office Supply Co', msdsRequired: false, msdsLink: '', fifoRequired: false, remarks: '', status: 'Active', createdAt: '2025-04-01', updatedAt: '2025-04-01' },
  { id: '13', itemCode: 'STA-TPE-003', itemName: 'Adhesive Tape Roll', category: 'Stationery', subcategory: 'Adhesive', unitOfMeasure: 'Piece', location: 'D-01-03', trackerGroup: 'Stationery', batchControlled: false, fefoEnabled: false, minimumStock: 15, maximumStock: 150, reorderLevel: 30, standardShelfLife: 0, manufacturer: 'StickWell', supplier: 'Office Supply Co', msdsRequired: false, msdsLink: '', fifoRequired: false, remarks: '', status: 'Active', createdAt: '2025-04-01', updatedAt: '2025-04-01' },
  { id: '14', itemCode: 'QC-FLT-001', itemName: 'Test Filter Kit', category: 'Quality', subcategory: 'Testing', unitOfMeasure: 'Kit', location: 'E-01-01', trackerGroup: 'QC', batchControlled: true, fefoEnabled: true, minimumStock: 5, maximumStock: 50, reorderLevel: 10, standardShelfLife: 365, manufacturer: 'QualityPro', supplier: 'QC Supplies Ltd', msdsRequired: false, msdsLink: '', fifoRequired: false, remarks: '', status: 'Active', createdAt: '2025-04-01', updatedAt: '2025-04-01' },
  { id: '15', itemCode: 'QC-SMP-002', itemName: 'Sample Collection Bags', category: 'Quality', subcategory: 'Sampling', unitOfMeasure: 'Box(100)', location: 'E-01-02', trackerGroup: 'QC', batchControlled: false, fefoEnabled: false, minimumStock: 10, maximumStock: 100, reorderLevel: 25, standardShelfLife: 0, manufacturer: 'QualityPro', supplier: 'QC Supplies Ltd', msdsRequired: false, msdsLink: '', fifoRequired: false, remarks: '', status: 'Active', createdAt: '2025-04-01', updatedAt: '2025-04-01' },
];

const mockEmployees: Employee[] = [
  { id: '1', employeeId: 'EMP-001', employeeName: 'Ahmed Al-Rashid', department: 'Operations', position: 'Warehouse Operator', location: 'Warehouse A', hireDate: '2023-06-15', status: 'Active', createdAt: '2023-06-15', updatedAt: '2023-06-15' },
  { id: '2', employeeId: 'EMP-002', employeeName: 'Mohammed Hassan', department: 'Operations', position: 'Forklift Operator', location: 'Warehouse A', hireDate: '2023-08-20', status: 'Active', createdAt: '2023-08-20', updatedAt: '2023-08-20' },
  { id: '3', employeeId: 'EMP-003', employeeName: 'Fatima Al-Sayed', department: 'Quality', position: 'QC Inspector', location: 'Warehouse B', hireDate: '2024-01-10', status: 'Active', createdAt: '2024-01-10', updatedAt: '2024-01-10' },
  { id: '4', employeeId: 'EMP-004', employeeName: 'Ali bin Khalid', department: 'Maintenance', position: 'Maintenance Tech', location: 'Warehouse A', hireDate: '2024-03-05', status: 'Active', createdAt: '2024-03-05', updatedAt: '2024-03-05' },
  { id: '5', employeeId: 'EMP-005', employeeName: 'Omar Al-Farsi', department: 'Operations', position: 'Picker', location: 'Warehouse B', hireDate: '2024-06-01', status: 'Active', createdAt: '2024-06-01', updatedAt: '2024-06-01' },
  { id: '6', employeeId: 'EMP-006', employeeName: 'Khalid Al-Maamari', department: 'Logistics', position: 'Logistics Coordinator', location: 'Warehouse A', hireDate: '2024-09-15', status: 'Active', createdAt: '2024-09-15', updatedAt: '2024-09-15' },
];

const mockStockInRecords: StockInRecord[] = [
  { id: 'si1', grnNumber: 'GRN-20250401-0001', receiptDate: '2025-04-01', itemId: '1', itemCode: 'PPE-GLV-001', itemName: 'Nitrile Gloves (L)', quantity: 200, unit: 'Box', batchId: 'BATCH-20250401-0001', dom: '2025-03-15', bbd: '2028-03-15', expiryDate: '2028-03-15', supplier: 'SafetyFirst Ltd', warehouseLocation: 'A-01-01', purchaseOrder: 'PO-001', referenceNumber: 'REF-001', remarks: 'Regular stock', createdBy: 'admin', createdAt: '2025-04-01T08:30:00' },
  { id: 'si2', grnNumber: 'GRN-20250401-0002', receiptDate: '2025-04-01', itemId: '2', itemCode: 'PPE-MSK-002', itemName: 'N95 Respirator Mask', quantity: 100, unit: 'Box', batchId: 'BATCH-20250401-0002', dom: '2025-03-20', bbd: '2027-03-20', expiryDate: '2027-03-20', supplier: 'SafetyFirst Ltd', warehouseLocation: 'A-01-02', purchaseOrder: 'PO-002', referenceNumber: 'REF-002', remarks: 'Regular stock', createdBy: 'admin', createdAt: '2025-04-01T09:00:00' },
  { id: 'si3', grnNumber: 'GRN-20250405-0001', receiptDate: '2025-04-05', itemId: '5', itemCode: 'CHE-CLN-005', itemName: 'Industrial Cleaner 5L', quantity: 30, unit: 'Drum', batchId: 'BATCH-20250405-0001', dom: '2025-04-01', bbd: '2026-10-01', expiryDate: '2026-10-01', supplier: 'ChemSupply Co', warehouseLocation: 'C-02-01', purchaseOrder: 'PO-003', referenceNumber: 'REF-003', remarks: 'Chemical storage', createdBy: 'admin', createdAt: '2025-04-05T10:15:00' },
  { id: 'si4', grnNumber: 'GRN-20250410-0001', receiptDate: '2025-04-10', itemId: '1', itemCode: 'PPE-GLV-001', itemName: 'Nitrile Gloves (L)', quantity: 150, unit: 'Box', batchId: 'BATCH-20250410-0001', dom: '2025-04-05', bbd: '2028-04-05', expiryDate: '2028-04-05', supplier: 'SafetyFirst Ltd', warehouseLocation: 'A-01-01', purchaseOrder: 'PO-004', referenceNumber: 'REF-004', remarks: 'Additional stock', createdBy: 'admin', createdAt: '2025-04-10T11:00:00' },
  { id: 'si5', grnNumber: 'GRN-20250415-0001', receiptDate: '2025-04-15', itemId: '3', itemCode: 'PPE-EST-003', itemName: 'Safety Glasses', quantity: 50, unit: 'Piece', batchId: 'BATCH-20250415-0001', dom: '2025-04-10', bbd: '2030-04-10', expiryDate: '2030-04-10', supplier: 'ProtectAll Inc', warehouseLocation: 'A-02-01', purchaseOrder: 'PO-005', referenceNumber: 'REF-005', remarks: 'Restock', createdBy: 'admin', createdAt: '2025-04-15T09:30:00' },
  { id: 'si6', grnNumber: 'GRN-20250420-0001', receiptDate: '2025-04-20', itemId: '7', itemCode: 'PPE-HLM-007', itemName: 'Hard Hat (White)', quantity: 30, unit: 'Piece', batchId: 'BATCH-20250420-0001', dom: '2025-04-15', bbd: '2030-04-15', expiryDate: '2030-04-15', supplier: 'SafetyFirst Ltd', warehouseLocation: 'A-03-01', purchaseOrder: 'PO-006', referenceNumber: 'REF-006', remarks: 'New batch', createdBy: 'admin', createdAt: '2025-04-20T14:00:00' },
  { id: 'si7', grnNumber: 'GRN-20250425-0001', receiptDate: '2025-04-25', itemId: '8', itemCode: 'PPE-HNS-008', itemName: 'Hi-Vis Safety Vest', quantity: 40, unit: 'Piece', batchId: 'BATCH-20250425-0001', dom: '2025-04-20', bbd: '2028-04-20', expiryDate: '2028-04-20', supplier: 'SafetyFirst Ltd', warehouseLocation: 'A-04-01', purchaseOrder: 'PO-007', referenceNumber: 'REF-007', remarks: 'Restock', createdBy: 'admin', createdAt: '2025-04-25T10:00:00' },
  { id: 'si8', grnNumber: 'GRN-20250501-0001', receiptDate: '2025-05-01', itemId: '4', itemCode: 'PPE-BOT-004', itemName: 'Steel Toe Boots', quantity: 15, unit: 'Pair', batchId: 'BATCH-20250501-0001', dom: '2025-04-25', bbd: '2028-04-25', expiryDate: '2028-04-25', supplier: 'ProtectAll Inc', warehouseLocation: 'A-05-01', purchaseOrder: 'PO-008', referenceNumber: 'REF-008', remarks: 'New shipment', createdBy: 'admin', createdAt: '2025-05-01T08:00:00' },
];

const mockBatchLedger: BatchLedgerEntry[] = [
  { id: 'bl1', batchId: 'BATCH-20250401-0001', itemId: '1', itemCode: 'PPE-GLV-001', itemName: 'Nitrile Gloves (L)', dom: '2025-03-15', bbd: '2028-03-15', expiryDate: '2028-03-15', quantityIn: 200, quantityOut: 45, balance: 155, status: 'Active', createdAt: '2025-04-01T08:30:00', updatedAt: '2025-05-20T10:00:00' },
  { id: 'bl2', batchId: 'BATCH-20250401-0002', itemId: '2', itemCode: 'PPE-MSK-002', itemName: 'N95 Respirator Mask', dom: '2025-03-20', bbd: '2027-03-20', expiryDate: '2027-03-20', quantityIn: 100, quantityOut: 20, balance: 80, status: 'Active', createdAt: '2025-04-01T09:00:00', updatedAt: '2025-05-18T14:00:00' },
  { id: 'bl3', batchId: 'BATCH-20250405-0001', itemId: '5', itemCode: 'CHE-CLN-005', itemName: 'Industrial Cleaner 5L', dom: '2025-04-01', bbd: '2026-10-01', expiryDate: '2026-10-01', quantityIn: 30, quantityOut: 5, balance: 25, status: 'Active', createdAt: '2025-04-05T10:15:00', updatedAt: '2025-05-15T09:00:00' },
  { id: 'bl4', batchId: 'BATCH-20250410-0001', itemId: '1', itemCode: 'PPE-GLV-001', itemName: 'Nitrile Gloves (L)', dom: '2025-04-05', bbd: '2028-04-05', expiryDate: '2028-04-05', quantityIn: 150, quantityOut: 30, balance: 120, status: 'Active', createdAt: '2025-04-10T11:00:00', updatedAt: '2025-05-22T11:00:00' },
  { id: 'bl5', batchId: 'BATCH-20250415-0001', itemId: '3', itemCode: 'PPE-EST-003', itemName: 'Safety Glasses', dom: '2025-04-10', bbd: '2030-04-10', expiryDate: '2030-04-10', quantityIn: 50, quantityOut: 10, balance: 40, status: 'Active', createdAt: '2025-04-15T09:30:00', updatedAt: '2025-05-10T16:00:00' },
  { id: 'bl6', batchId: 'BATCH-20250420-0001', itemId: '7', itemCode: 'PPE-HLM-007', itemName: 'Hard Hat (White)', dom: '2025-04-15', bbd: '2030-04-15', expiryDate: '2030-04-15', quantityIn: 30, quantityOut: 8, balance: 22, status: 'Active', createdAt: '2025-04-20T14:00:00', updatedAt: '2025-05-19T08:00:00' },
  { id: 'bl7', batchId: 'BATCH-20250425-0001', itemId: '8', itemCode: 'PPE-HNS-008', itemName: 'Hi-Vis Safety Vest', dom: '2025-04-20', bbd: '2028-04-20', expiryDate: '2028-04-20', quantityIn: 40, quantityOut: 12, balance: 28, status: 'Active', createdAt: '2025-04-25T10:00:00', updatedAt: '2025-05-21T15:00:00' },
  { id: 'bl8', batchId: 'BATCH-20250501-0001', itemId: '4', itemCode: 'PPE-BOT-004', itemName: 'Steel Toe Boots', dom: '2025-04-25', bbd: '2028-04-25', expiryDate: '2028-04-25', quantityIn: 15, quantityOut: 3, balance: 12, status: 'Active', createdAt: '2025-05-01T08:00:00', updatedAt: '2025-05-20T13:00:00' },
];

const mockStockOutRecords: StockOutRecord[] = [
  { id: 'so1', issueNumber: 'ISS-20250405-0001', issueDate: '2025-04-05', employeeId: '1', employeeName: 'Ahmed Al-Rashid', department: 'Operations', itemId: '1', itemCode: 'PPE-GLV-001', itemName: 'Nitrile Gloves (L)', quantity: 10, batchId: 'BATCH-20250401-0001', jobNumber: 'JOB-001', remarks: 'Weekly PPE', createdBy: 'admin', createdAt: '2025-04-05T08:00:00' },
  { id: 'so2', issueNumber: 'ISS-20250410-0001', issueDate: '2025-04-10', employeeId: '2', employeeName: 'Mohammed Hassan', department: 'Operations', itemId: '2', itemCode: 'PPE-MSK-002', itemName: 'N95 Respirator Mask', quantity: 5, batchId: 'BATCH-20250401-0002', jobNumber: 'JOB-002', remarks: 'Monthly issue', createdBy: 'admin', createdAt: '2025-04-10T09:00:00' },
  { id: 'so3', issueNumber: 'ISS-20250415-0001', issueDate: '2025-04-15', employeeId: '3', employeeName: 'Fatima Al-Sayed', department: 'Quality', itemId: '3', itemCode: 'PPE-EST-003', itemName: 'Safety Glasses', quantity: 2, batchId: 'BATCH-20250415-0001', jobNumber: 'JOB-003', remarks: 'Replacement', createdBy: 'admin', createdAt: '2025-04-15T10:00:00' },
  { id: 'so4', issueNumber: 'ISS-20250420-0001', issueDate: '2025-04-20', employeeId: '1', employeeName: 'Ahmed Al-Rashid', department: 'Operations', itemId: '1', itemCode: 'PPE-GLV-001', itemName: 'Nitrile Gloves (L)', quantity: 15, batchId: 'BATCH-20250401-0001', jobNumber: 'JOB-004', remarks: 'Weekly PPE', createdBy: 'admin', createdAt: '2025-04-20T08:30:00' },
  { id: 'so5', issueNumber: 'ISS-20250425-0001', issueDate: '2025-04-25', employeeId: '4', employeeName: 'Ali bin Khalid', department: 'Maintenance', itemId: '5', itemCode: 'CHE-CLN-005', itemName: 'Industrial Cleaner 5L', quantity: 3, batchId: 'BATCH-20250405-0001', jobNumber: 'JOB-005', remarks: 'Maintenance use', createdBy: 'admin', createdAt: '2025-04-25T11:00:00' },
  { id: 'so6', issueNumber: 'ISS-20250501-0001', issueDate: '2025-05-01', employeeId: '5', employeeName: 'Omar Al-Farsi', department: 'Operations', itemId: '1', itemCode: 'PPE-GLV-001', itemName: 'Nitrile Gloves (L)', quantity: 20, batchId: 'BATCH-20250410-0001', jobNumber: 'JOB-006', remarks: 'Team allocation', createdBy: 'admin', createdAt: '2025-05-01T08:00:00' },
  { id: 'so7', issueNumber: 'ISS-20250505-0001', issueDate: '2025-05-05', employeeId: '6', employeeName: 'Khalid Al-Maamari', department: 'Logistics', itemId: '8', itemCode: 'PPE-HNS-008', itemName: 'Hi-Vis Safety Vest', quantity: 5, batchId: 'BATCH-20250425-0001', jobNumber: 'JOB-007', remarks: 'New hire kits', createdBy: 'admin', createdAt: '2025-05-05T09:30:00' },
  { id: 'so8', issueNumber: 'ISS-20250510-0001', issueDate: '2025-05-10', employeeId: '2', employeeName: 'Mohammed Hassan', department: 'Operations', itemId: '4', itemCode: 'PPE-BOT-004', itemName: 'Steel Toe Boots', quantity: 1, batchId: 'BATCH-20250501-0001', jobNumber: 'JOB-008', remarks: 'Replacement', createdBy: 'admin', createdAt: '2025-05-10T10:00:00' },
  { id: 'so9', issueNumber: 'ISS-20250515-0001', issueDate: '2025-05-15', employeeId: '1', employeeName: 'Ahmed Al-Rashid', department: 'Operations', itemId: '7', itemCode: 'PPE-HLM-007', itemName: 'Hard Hat (White)', quantity: 2, batchId: 'BATCH-20250420-0001', jobNumber: 'JOB-009', remarks: 'Replacement', createdBy: 'admin', createdAt: '2025-05-15T14:00:00' },
  { id: 'so10', issueNumber: 'ISS-20250520-0001', issueDate: '2025-05-20', employeeId: '3', employeeName: 'Fatima Al-Sayed', department: 'Quality', itemId: '1', itemCode: 'PPE-GLV-001', itemName: 'Nitrile Gloves (L)', quantity: 10, batchId: 'BATCH-20250410-0001', jobNumber: 'JOB-010', remarks: 'Lab use', createdBy: 'admin', createdAt: '2025-05-20T09:00:00' },
];

const currentUser: User = {
  id: 'u1',
  username: 'admin',
  email: 'admin@wms.local',
  role: 'Administrator',
  status: 'Active',
  createdAt: '2025-01-01',
};

const mockJobs: Job[] = [
  { id: 'j1', jobNumber: 'JOB-001', jobName: 'Annual Maintenance', description: 'Annual plant maintenance shutdown', status: 'Completed', startDate: '2025-04-01', endDate: '2025-04-30', createdAt: '2025-03-15', updatedAt: '2025-04-30' },
  { id: 'j2', jobNumber: 'JOB-002', jobName: 'Unit 3 Overhaul', description: 'Complete overhaul of Unit 3 compressor', status: 'Completed', startDate: '2025-04-10', endDate: '2025-04-20', createdAt: '2025-04-01', updatedAt: '2025-04-20' },
  { id: 'j3', jobNumber: 'JOB-003', jobName: 'Safety Upgrade', description: 'Safety equipment upgrade project', status: 'Completed', startDate: '2025-04-15', endDate: '2025-05-15', createdAt: '2025-04-10', updatedAt: '2025-05-15' },
  { id: 'j4', jobNumber: 'JOB-004', jobName: 'Line 2 Repair', description: 'Production line 2 breakdown repair', status: 'Completed', startDate: '2025-04-20', endDate: '2025-04-25', createdAt: '2025-04-18', updatedAt: '2025-04-25' },
  { id: 'j5', jobNumber: 'JOB-005', jobName: 'Pump Replacement', description: 'Main coolant pump replacement', status: 'Completed', startDate: '2025-04-25', endDate: '2025-05-05', createdAt: '2025-04-20', updatedAt: '2025-05-05' },
  { id: 'j6', jobNumber: 'JOB-006', jobName: 'New Hire Onboarding', description: 'Material allocation for new hire batch', status: 'Active', startDate: '2025-05-01', endDate: '2025-06-30', createdAt: '2025-04-25', updatedAt: '2025-05-01' },
  { id: 'j7', jobNumber: 'JOB-007', jobName: 'Warehouse Reorg', description: 'Warehouse reorganization project', status: 'Active', startDate: '2025-05-05', endDate: '2025-07-31', createdAt: '2025-05-01', updatedAt: '2025-05-05' },
  { id: 'j8', jobNumber: 'JOB-008', jobName: 'Booth Replacement', description: 'Boot replacement for operations team', status: 'Active', startDate: '2025-05-10', endDate: '2025-06-10', createdAt: '2025-05-05', updatedAt: '2025-05-10' },
  { id: 'j9', jobNumber: 'JOB-009', jobName: 'Helmets Refresh', description: 'Hard hat replacement program', status: 'Active', startDate: '2025-05-15', endDate: '2025-06-15', createdAt: '2025-05-10', updatedAt: '2025-05-15' },
  { id: 'j10', jobNumber: 'JOB-010', jobName: 'Lab Supplies', description: 'QC lab material restocking', status: 'Active', startDate: '2025-05-20', endDate: '2025-06-20', createdAt: '2025-05-15', updatedAt: '2025-05-20' },
];

const allPermissions: Permission[] = [
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
];

const ROLE_MAP: Record<string, Permission[]> = {
  'Administrator': allPermissions,
  'Warehouse Manager': allPermissions.filter(p => !['users.view', 'users.create', 'users.edit', 'settings.view', 'settings.edit'].includes(p)),
  'Warehouse Supervisor': ['dashboard.view', 'items.view', 'employees.view', 'stockin.view', 'stockin.create', 'stockout.view', 'stockout.create', 'batch.view', 'inventory.view', 'inventory.count', 'expiry.view', 'reports.view'],
  'Storekeeper': ['dashboard.view', 'items.view', 'employees.view', 'stockin.view', 'stockin.create', 'stockout.view', 'stockout.create', 'batch.view', 'inventory.view', 'expiry.view'],
  'Viewer': ['dashboard.view', 'items.view', 'employees.view', 'stockin.view', 'stockout.view', 'batch.view', 'inventory.view', 'expiry.view', 'reports.view'],
};

function logAudit(state: WMSState, action: string, module: string, recordId: string, before: unknown, after: unknown): AuditTrailEntry {
  return {
    id: generateId(),
    action,
    module,
    recordId,
    beforeValue: before ? JSON.stringify(before, null, 2) : '',
    afterValue: after ? JSON.stringify(after, null, 2) : '',
    performedBy: state.currentUser.username,
    performedAt: new Date().toISOString(),
    ipAddress: '192.168.3.112',
  };
}

export const useWMSStore = create<WMSState>()(persist((set, get) => ({
  masterItems: mockMasterItems,
  employees: mockEmployees,
  stockInRecords: mockStockInRecords,
  batchLedger: mockBatchLedger,
  stockOutRecords: mockStockOutRecords,
  inventoryBalances: [],
  stockAdjustments: [],
  expiryAlerts: [],
  auditTrail: [],
  users: [currentUser],
  currentUser,
  jobs: mockJobs,
  stockAlerts: [],
  alertEmail: 'yousifg028@gmail.com',
  quarantineMaterials: [],
  clientMaterials: [],
  jobMaterials: [],
  categories: ['PPE', 'Chemical', 'Spare Parts', 'Lubricant', 'Consumable', 'Stationery', 'Quality'],
  batchSequence: 9,
  grnSequence: 9,
  issueSequence: 11,
  adjustmentSequence: 1,

  addItem: (item) => set((state) => {
    const now = new Date().toISOString();
    const newItem: MasterItem = { ...item, id: generateId(), createdAt: now, updatedAt: now };
    const audit = logAudit(state, 'Create Item', 'Master Items', newItem.id, null, newItem);
    return { masterItems: [...state.masterItems, newItem], auditTrail: [...state.auditTrail, audit] };
  }),

  updateItem: (id, updates) => set((state) => {
    const old = state.masterItems.find(i => i.id === id);
    const audit = logAudit(state, 'Update Item', 'Master Items', id, old, { ...old, ...updates });
    return {
      masterItems: state.masterItems.map(item => item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  archiveItem: (id) => set((state) => {
    const old = state.masterItems.find(i => i.id === id);
    const audit = logAudit(state, 'Archive Item', 'Master Items', id, old, { ...old, status: 'Archived' });
    return {
      masterItems: state.masterItems.map(item => item.id === id ? { ...item, status: 'Archived' as const, updatedAt: new Date().toISOString() } : item),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  restoreItem: (id) => set((state) => {
    const old = state.masterItems.find(i => i.id === id);
    const audit = logAudit(state, 'Restore Item', 'Master Items', id, old, { ...old, status: 'Active' });
    return {
      masterItems: state.masterItems.map(item => item.id === id ? { ...item, status: 'Active' as const, updatedAt: new Date().toISOString() } : item),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  deleteItem: (id) => set((state) => {
    const old = state.masterItems.find(i => i.id === id);
    const audit = logAudit(state, 'Delete Item', 'Master Items', id, old, null);
    return {
      masterItems: state.masterItems.filter(item => item.id !== id),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  addEmployee: (emp) => set((state) => {
    const now = new Date().toISOString();
    const newEmp: Employee = { ...emp, id: generateId(), createdAt: now, updatedAt: now };
    const audit = logAudit(state, 'Add Employee', 'Employees', newEmp.id, null, newEmp);
    return { employees: [...state.employees, newEmp], auditTrail: [...state.auditTrail, audit] };
  }),

  updateEmployee: (id, updates) => set((state) => {
    const old = state.employees.find(e => e.id === id);
    const audit = logAudit(state, 'Update Employee', 'Employees', id, old, { ...old, ...updates });
    return {
      employees: state.employees.map(emp => emp.id === id ? { ...emp, ...updates, updatedAt: new Date().toISOString() } : emp),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  createStockIn: (record) => {
    const state = get();
    const batchId = generateBatchId(record.receiptDate, state.batchSequence);
    const grnNumber = generateGRN(state.grnSequence);
    const now = new Date().toISOString();
    const newStockIn: StockInRecord = { ...record, id: generateId(), grnNumber, batchId, createdAt: now };
    const newBatch: BatchLedgerEntry = {
      id: generateId(), batchId, itemId: record.itemId, itemCode: record.itemCode, itemName: record.itemName,
      dom: record.dom, bbd: record.bbd, expiryDate: record.expiryDate,
      quantityIn: record.quantity, quantityOut: 0, balance: record.quantity,
      status: 'Active', createdAt: now, updatedAt: now,
    };
    const existingBalance = state.inventoryBalances.find(b => b.itemId === record.itemId);
    const newBalance: InventoryBalance = existingBalance
      ? { ...existingBalance, totalQuantity: existingBalance.totalQuantity + record.quantity, availableQuantity: existingBalance.availableQuantity + record.quantity, lastUpdated: now }
      : { id: generateId(), itemId: record.itemId, itemCode: record.itemCode, itemName: record.itemName, totalQuantity: record.quantity, availableQuantity: record.quantity, reservedQuantity: 0, lastUpdated: now };
    const audit = logAudit(state, 'Stock In', 'Stock In', grnNumber, null, { grnNumber, item: record.itemName, qty: record.quantity, batchId });
    set({
      stockInRecords: [...state.stockInRecords, newStockIn],
      batchLedger: [...state.batchLedger, newBatch],
      inventoryBalances: existingBalance
        ? state.inventoryBalances.map(b => b.itemId === record.itemId ? newBalance : b)
        : [...state.inventoryBalances, newBalance],
      batchSequence: state.batchSequence + 1,
      grnSequence: state.grnSequence + 1,
      auditTrail: [...state.auditTrail, audit],
    });
    return batchId;
  },

  deleteStockIn: (id) => set((state) => {
    const record = state.stockInRecords.find(r => r.id === id);
    if (!record) return state;
    const audit = logAudit(state, 'Delete Stock In', 'Stock In', record.grnNumber, record, null);
    const batch = state.batchLedger.find(b => b.batchId === record.batchId);
    const qty = batch ? batch.balance : record.quantity;
    return {
      stockInRecords: state.stockInRecords.filter(r => r.id !== id),
      batchLedger: state.batchLedger.filter(b => b.batchId !== record.batchId),
      inventoryBalances: state.inventoryBalances.map(b =>
        b.itemId === record.itemId
          ? { ...b, totalQuantity: b.totalQuantity - qty, availableQuantity: b.availableQuantity - qty, lastUpdated: new Date().toISOString() }
          : b
      ),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  updateStockIn: (id, updates) => set((state) => {
    const old = state.stockInRecords.find(r => r.id === id);
    if (!old) return state;
    const audit = logAudit(state, 'Update Stock In', 'Stock In', old.grnNumber, old, { ...old, ...updates });
    return {
      stockInRecords: state.stockInRecords.map(r => r.id === id ? { ...r, ...updates } : r),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  createStockOut: (record) => {
    const state = get();
    const item = state.masterItems.find(i => i.id === record.itemId);
    if (!item) return null;
    const balance = state.inventoryBalances.find(b => b.itemId === record.itemId);
    if (!balance || balance.availableQuantity < record.quantity) return null;
    const issueNumber = generateIssueNumber(state.issueSequence);
    const now = new Date().toISOString();

    let allocations: { batchId: string; quantity: number }[] | null = null;
    if (item.fefoEnabled && item.batchControlled) {
      allocations = allocateFEFO(state.batchLedger.filter(b => b.itemId === record.itemId), record.quantity);
    } else {
      allocations = allocateFIFO(state.batchLedger.filter(b => b.itemId === record.itemId), record.quantity);
    }
    if (!allocations) return null;

    let updatedBatches = [...state.batchLedger];
    for (const alloc of allocations) {
      updatedBatches = updatedBatches.map(b =>
        b.batchId === alloc.batchId ? { ...b, quantityOut: b.quantityOut + alloc.quantity, balance: b.balance - alloc.quantity, updatedAt: now } : b
      );
    }
    const newStockOut: StockOutRecord = { ...record, id: generateId(), issueNumber, batchId: allocations[0].batchId, createdAt: now };
    const audit = logAudit(state, 'Stock Out', 'Stock Out', issueNumber, null, { issueNumber, employee: record.employeeName, item: record.itemName, qty: record.quantity, batch: allocations[0].batchId });

    const newBalanceQty = balance.availableQuantity - record.quantity;
    const newAlerts: StockAlert[] = [];

    if (newBalanceQty === 0) {
      newAlerts.push({
        id: generateId(), type: 'Out of Stock', severity: 'critical',
        title: `Out of Stock: ${item.itemName}`,
        message: `${item.itemName} (${item.itemCode}) is now out of stock. Issued ${record.quantity} ${item.unitOfMeasure} to ${record.employeeName} for ${record.jobNumber || 'N/A'}.`,
        itemId: item.id, itemCode: item.itemCode, itemName: item.itemName,
        currentQty: 0, reorderLevel: item.reorderLevel, read: false, createdAt: now,
      });
    } else if (newBalanceQty <= item.reorderLevel) {
      newAlerts.push({
        id: generateId(), type: 'Low Stock', severity: 'warning',
        title: `Low Stock: ${item.itemName}`,
        message: `${item.itemName} (${item.itemCode}) is low on stock. Current: ${newBalanceQty} ${item.unitOfMeasure}, Reorder Level: ${item.reorderLevel}. Issued ${record.quantity} to ${record.employeeName}.`,
        itemId: item.id, itemCode: item.itemCode, itemName: item.itemName,
        currentQty: newBalanceQty, reorderLevel: item.reorderLevel, read: false, createdAt: now,
      });
    }

    newAlerts.push({
      id: generateId(), type: 'Stock Issued', severity: 'info',
      title: `Stock Issued: ${item.itemName}`,
      message: `${record.quantity} ${item.unitOfMeasure} of ${item.itemName} issued to ${record.employeeName} (${record.jobNumber || 'No Job'}). Issue #: ${issueNumber}`,
      itemId: item.id, itemCode: item.itemCode, itemName: item.itemName,
      currentQty: newBalanceQty, reorderLevel: item.reorderLevel, read: false, createdAt: now,
    });

    if (newAlerts.length > 0 && state.alertEmail) {
      fetch('/api/send-alert-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.alertEmail, alerts: newAlerts }),
      }).catch(() => {});
    }

    set({
      stockOutRecords: [...state.stockOutRecords, newStockOut],
      batchLedger: updatedBatches,
      inventoryBalances: state.inventoryBalances.map(b =>
        b.itemId === record.itemId ? { ...b, totalQuantity: b.totalQuantity - record.quantity, availableQuantity: b.availableQuantity - record.quantity, lastUpdated: now } : b
      ),
      stockAlerts: [...newAlerts, ...state.stockAlerts],
      issueSequence: state.issueSequence + 1,
      auditTrail: [...state.auditTrail, audit],
    });
    return issueNumber;
  },

  deleteStockOut: (id) => set((state) => {
    const record = state.stockOutRecords.find(r => r.id === id);
    if (!record) return state;
    const audit = logAudit(state, 'Delete Stock Out', 'Stock Out', record.issueNumber, record, null);
    return {
      stockOutRecords: state.stockOutRecords.filter(r => r.id !== id),
      batchLedger: state.batchLedger.map(b =>
        b.batchId === record.batchId
          ? { ...b, quantityOut: Math.max(0, b.quantityOut - record.quantity), balance: b.balance + record.quantity, updatedAt: new Date().toISOString() }
          : b
      ),
      inventoryBalances: state.inventoryBalances.map(b =>
        b.itemId === record.itemId
          ? { ...b, totalQuantity: b.totalQuantity + record.quantity, availableQuantity: b.availableQuantity + record.quantity, lastUpdated: new Date().toISOString() }
          : b
      ),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  updateStockOut: (id, updates) => set((state) => {
    const old = state.stockOutRecords.find(r => r.id === id);
    if (!old) return state;
    const audit = logAudit(state, 'Update Stock Out', 'Stock Out', old.issueNumber, old, { ...old, ...updates });
    return {
      stockOutRecords: state.stockOutRecords.map(r => r.id === id ? { ...r, ...updates } : r),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  applyServerStockOut: (record) => {
    const state = get();
    const exists = state.stockOutRecords.find(r => r.id === record.id || r.issueNumber === record.issueNumber);
    if (exists) return;

    const now = new Date().toISOString();
    const item = state.masterItems.find(i => i.itemCode === record.itemCode || i.id === record.itemId);
    const balance = item ? state.inventoryBalances.find(b => b.itemId === item.id) : null;
    let updatedBatches = [...state.batchLedger];
    let updatedBalances = [...state.inventoryBalances];

    if (balance && item) {
      updatedBalances = updatedBalances.map(b =>
        b.itemId === item.id ? { ...b, totalQuantity: b.totalQuantity - record.quantity, availableQuantity: Math.max(0, b.availableQuantity - record.quantity), lastUpdated: now } : b
      );
      const batches = state.batchLedger.filter(b => b.itemId === item.id && b.balance > 0);
      if (batches.length > 0) {
        let remaining = record.quantity;
        updatedBatches = updatedBatches.map(b => {
          if (b.itemId !== item.id || b.balance <= 0 || remaining <= 0) return b;
          const deduct = Math.min(b.balance, remaining);
          remaining -= deduct;
          return { ...b, quantityOut: b.quantityOut + deduct, balance: b.balance - deduct, updatedAt: now };
        });
      }
    }

    set({
      stockOutRecords: [...state.stockOutRecords, record],
      inventoryBalances: updatedBalances,
      batchLedger: updatedBatches,
    });
  },

  createStockAdjustment: (adj) => set((state) => {
    const adjustmentNumber = generateAdjustmentNumber(state.adjustmentSequence);
    const now = new Date().toISOString();
    const newAdj: StockAdjustment = { ...adj, id: generateId(), adjustmentNumber, createdAt: now };
    const batch = state.batchLedger.find(b => b.batchId === adj.batchId);
    const updatedBatch = batch
      ? { ...batch, balance: adj.quantityAfter, quantityIn: adj.adjustmentType === 'Addition' ? batch.quantityIn + adj.quantityAdjusted : batch.quantityIn, quantityOut: adj.adjustmentType === 'Deduction' ? batch.quantityOut + adj.quantityAdjusted : batch.quantityOut, updatedAt: now }
      : null;
    const audit = logAudit(state, 'Stock Adjustment', 'Inventory', adjustmentNumber, { before: adj.quantityBefore, batch: adj.batchId }, { after: adj.quantityAfter, type: adj.adjustmentType, reason: adj.reason });
    return {
      stockAdjustments: [...state.stockAdjustments, newAdj],
      batchLedger: updatedBatch ? state.batchLedger.map(b => b.batchId === adj.batchId ? updatedBatch : b) : state.batchLedger,
      adjustmentSequence: state.adjustmentSequence + 1,
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  addAuditEntry: (entry) => set((state) => ({
    auditTrail: [...state.auditTrail, { ...entry, id: generateId(), performedAt: new Date().toISOString(), ipAddress: '192.168.3.112' }],
  })),

  addUser: (user) => set((state) => ({
    users: [...state.users, { ...user, id: generateId(), createdAt: new Date().toISOString() } as any],
  })),

  setCurrentUser: (user) => set({ currentUser: user }),

  addJob: (job) => set((state) => {
    const now = new Date().toISOString();
    const newJob: Job = { ...job, id: generateId(), createdAt: now, updatedAt: now };
    const audit = logAudit(state, 'Create Job', 'Jobs', newJob.id, null, newJob);
    return { jobs: [...state.jobs, newJob], auditTrail: [...state.auditTrail, audit] };
  }),

  updateJob: (id, updates) => set((state) => {
    const old = state.jobs.find(j => j.id === id);
    const audit = logAudit(state, 'Update Job', 'Jobs', id, old, { ...old, ...updates });
    return {
      jobs: state.jobs.map(j => j.id === id ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  archiveJob: (id) => set((state) => {
    const old = state.jobs.find(j => j.id === id);
    const audit = logAudit(state, 'Archive Job', 'Jobs', id, old, { ...old, status: 'Archived' });
    return {
      jobs: state.jobs.map(j => j.id === id ? { ...j, status: 'Archived' as const, updatedAt: new Date().toISOString() } : j),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  restoreJob: (id) => set((state) => {
    const old = state.jobs.find(j => j.id === id);
    const audit = logAudit(state, 'Restore Job', 'Jobs', id, old, { ...old, status: 'Active' });
    return {
      jobs: state.jobs.map(j => j.id === id ? { ...j, status: 'Active' as const, updatedAt: new Date().toISOString() } : j),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  deleteJob: (id) => set((state) => {
    const old = state.jobs.find(j => j.id === id);
    const audit = logAudit(state, 'Delete Job', 'Jobs', id, old, null);
    return {
      jobs: state.jobs.filter(j => j.id !== id),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  addQuarantineMaterial: (item) => set((state) => {
    const now = new Date().toISOString();
    const newItem: QuarantineMaterial = { ...item, id: generateId(), createdAt: now, updatedAt: now };
    const audit = logAudit(state, 'Add Quarantine Material', 'Quarantine', newItem.id, null, newItem);
    return { quarantineMaterials: [...state.quarantineMaterials, newItem], auditTrail: [...state.auditTrail, audit] };
  }),

  updateQuarantineMaterial: (id, updates) => set((state) => {
    const old = state.quarantineMaterials.find(q => q.id === id);
    const audit = logAudit(state, 'Update Quarantine Material', 'Quarantine', id, old, { ...old, ...updates });
    return {
      quarantineMaterials: state.quarantineMaterials.map(q => q.id === id ? { ...q, ...updates, updatedAt: new Date().toISOString() } : q),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  deleteQuarantineMaterial: (id) => set((state) => {
    const old = state.quarantineMaterials.find(q => q.id === id);
    const audit = logAudit(state, 'Delete Quarantine Material', 'Quarantine', id, old, null);
    return {
      quarantineMaterials: state.quarantineMaterials.filter(q => q.id !== id),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  issueQuarantineMaterial: (id, qty, issuedTo, issuedDate, source, jobNumber, remarks) => {
    const state = get();
    const item = state.quarantineMaterials.find(q => q.id === id);
    if (!item) return;

    state.createStockOut({
      issueDate: issuedDate,
      employeeId: '',
      employeeName: issuedTo,
      department: '',
      itemId: '',
      itemCode: item.code,
      itemName: item.itemName,
      quantity: qty,
      jobNumber: jobNumber || '',
      remarks: remarks || `Quarantine Issue - ${item.code}`,
      createdBy: state.currentUser.username,
    });

    const newQtyOut = item.quantityOut + qty;
    const newBalance = item.quantityIn - newQtyOut;
    const updates = {
      quantityOut: newQtyOut,
      balance: newBalance,
      issuedTo,
      issuedDate,
      remarks,
    };
    set((state) => {
      const audit = logAudit(state, 'Issue from Quarantine', 'Quarantine', id, item, { ...item, ...updates, issueSource: source, jobNumber });
      return {
        quarantineMaterials: state.quarantineMaterials.map(q => q.id === id ? { ...q, ...updates, updatedAt: new Date().toISOString() } : q),
        auditTrail: [...state.auditTrail, audit],
      };
    });
  },

  releaseQuarantineMaterial: (id, status, inspectionResult, releaseDate, issuedTo, remarks) => set((state) => {
    const item = state.quarantineMaterials.find(q => q.id === id);
    if (!item) return state;
    const updates = {
      status,
      inspectionResult,
      releaseDate,
      issuedTo,
      remarks,
    };
    const audit = logAudit(state, 'Release/Reject Quarantine Material', 'Quarantine', id, item, { ...item, ...updates });
    return {
      quarantineMaterials: state.quarantineMaterials.map(q => q.id === id ? { ...q, ...updates, updatedAt: new Date().toISOString() } : q),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  addCategory: (category) => set((state) => {
    if (state.categories.includes(category)) return state;
    return { categories: [...state.categories, category] };
  }),

  deleteCategory: (category) => set((state) => ({
    categories: state.categories.filter(c => c !== category),
  })),

  addClientMaterial: (item) => set((state) => {
    const now = new Date().toISOString();
    const newItem: ClientMaterial = { ...item, id: generateId(), createdAt: now, updatedAt: now };
    const audit = logAudit(state, 'Add Client Material', 'Client Materials', newItem.id, null, newItem);
    return { clientMaterials: [...state.clientMaterials, newItem], auditTrail: [...state.auditTrail, audit] };
  }),

  updateClientMaterial: (id, updates) => set((state) => {
    const old = state.clientMaterials.find(c => c.id === id);
    const audit = logAudit(state, 'Update Client Material', 'Client Materials', id, old, { ...old, ...updates });
    return {
      clientMaterials: state.clientMaterials.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  deleteClientMaterial: (id) => set((state) => {
    const old = state.clientMaterials.find(c => c.id === id);
    const audit = logAudit(state, 'Delete Client Material', 'Client Materials', id, old, null);
    return {
      clientMaterials: state.clientMaterials.filter(c => c.id !== id),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  issueClientMaterial: (id, qty, issuedTo, issuedDate, source, jobNumber, remarks) => set((state) => {
    const item = state.clientMaterials.find(c => c.id === id);
    if (!item) return state;
    const updates = {
      quantityOut: item.quantityOut + qty,
      balance: item.balance - qty,
      status: (item.balance - qty <= 0 ? 'Issued' : 'In Stock') as ClientMaterial['status'],
      issuedTo,
      issuedDate,
      remarks,
    };
    const audit = logAudit(state, 'Issue Client Material', 'Client Materials', id, item, { ...item, ...updates, issueSource: source, jobNumber });
    return {
      clientMaterials: state.clientMaterials.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  returnClientMaterial: (id, qty) => set((state) => {
    const item = state.clientMaterials.find(c => c.id === id);
    if (!item) return state;
    const updates = {
      quantityOut: Math.max(0, item.quantityOut - qty),
      balance: item.balance + qty,
      status: 'Returned' as ClientMaterial['status'],
    };
    const audit = logAudit(state, 'Return Client Material', 'Client Materials', id, item, { ...item, ...updates });
    return {
      clientMaterials: state.clientMaterials.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  addJobMaterial: (item) => set((state) => {
    const now = new Date().toISOString();
    const newItem: JobMaterial = { ...item, id: generateId(), createdAt: now, updatedAt: now };
    const audit = logAudit(state, 'Add Job Material', 'Job Materials', newItem.id, null, newItem);
    return { jobMaterials: [...state.jobMaterials, newItem], auditTrail: [...state.auditTrail, audit] };
  }),

  updateJobMaterial: (id, updates) => set((state) => {
    const old = state.jobMaterials.find(j => j.id === id);
    const audit = logAudit(state, 'Update Job Material', 'Job Materials', id, old, { ...old, ...updates });
    return {
      jobMaterials: state.jobMaterials.map(j => j.id === id ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  deleteJobMaterial: (id) => set((state) => {
    const old = state.jobMaterials.find(j => j.id === id);
    const audit = logAudit(state, 'Delete Job Material', 'Job Materials', id, old, null);
    return {
      jobMaterials: state.jobMaterials.filter(j => j.id !== id),
      auditTrail: [...state.auditTrail, audit],
    };
  }),

  issueJobMaterial: (id, qty, issuedTo, issuedDate, remarks) => {
    const state = get();
    const item = state.jobMaterials.find(j => j.id === id);
    if (!item) return null;

    const masterItem = state.masterItems.find(m => m.itemCode === item.category || m.itemName === item.itemName);
    const stockOutResult = state.createStockOut({
      issueDate: issuedDate,
      employeeId: '',
      employeeName: issuedTo,
      department: '',
      itemId: masterItem ? masterItem.id : '',
      itemCode: masterItem ? masterItem.itemCode : item.category,
      itemName: item.itemName,
      quantity: qty,
      jobNumber: item.jobNumber,
      remarks: remarks || `Job Material Issue - ${item.code}`,
      createdBy: state.currentUser.username,
    });

    const updates = {
      quantity: Math.max(0, item.quantity - qty),
      status: (item.quantity - qty <= 0 ? 'Issued' : 'Pending') as JobMaterial['status'],
      issuedTo,
      issuedDate,
      remarks,
    };

    set((state) => {
      const audit = logAudit(state, 'Issue Job Material', 'Job Materials', id, item, { ...item, ...updates });
      return {
        jobMaterials: state.jobMaterials.map(j => j.id === id ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j),
        auditTrail: [...state.auditTrail, audit],
      };
    });

    return stockOutResult;
  },

  addAlert: (alert) => set((state) => ({
    stockAlerts: [{ ...alert, id: generateId(), createdAt: new Date().toISOString() }, ...state.stockAlerts],
  })),

  markAlertRead: (id) => set((state) => ({
    stockAlerts: state.stockAlerts.map(a => a.id === id ? { ...a, read: true } : a),
  })),

  markAllAlertsRead: () => set((state) => ({
    stockAlerts: state.stockAlerts.map(a => ({ ...a, read: true })),
  })),

  setAlertEmail: (email) => set({ alertEmail: email }),

  getUnreadAlertCount: () => get().stockAlerts.filter(a => !a.read).length,

  hasPermission: (perm) => {
    const state = get();
    const perms = ROLE_MAP[state.currentUser.role] || [];
    return perms.includes(perm);
  },

  getStockInByItem: (itemId) => get().stockInRecords.filter(r => r.itemId === itemId),
  getBatchesByItem: (itemId) => get().batchLedger.filter(b => b.itemId === itemId),
  getStockOutByEmployee: (empId) => get().stockOutRecords.filter(r => r.employeeId === empId),
  getEmployeePPEHistory: (empId) => get().stockOutRecords.filter(r => r.employeeId === empId),
}), {
  name: 'wms-storage',
  partialize: (state) => ({
    masterItems: state.masterItems,
    employees: state.employees,
    stockInRecords: state.stockInRecords,
    batchLedger: state.batchLedger,
    stockOutRecords: state.stockOutRecords,
    inventoryBalances: state.inventoryBalances,
    stockAdjustments: state.stockAdjustments,
    expiryAlerts: state.expiryAlerts,
    auditTrail: state.auditTrail,
    users: state.users,
    jobs: state.jobs,
    stockAlerts: state.stockAlerts,
    alertEmail: state.alertEmail,
    quarantineMaterials: state.quarantineMaterials,
    jobMaterials: state.jobMaterials,
    categories: state.categories,
    batchSequence: state.batchSequence,
    grnSequence: state.grnSequence,
    issueSequence: state.issueSequence,
    adjustmentSequence: state.adjustmentSequence,
  }),
}));
