const SHEET_NAMES = [
  'MasterItems', 'Employees', 'StockIn', 'StockOut',
  'BatchLedger', 'InventoryBalances', 'Jobs', 'AuditTrail', 'Users'
] as const;

type SheetName = typeof SHEET_NAMES[number];

export class GoogleSheetsSync {
  private baseUrl: string;
  private syncing = false;

  constructor(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  private async request(action: string, sheet?: string, data?: any): Promise<any> {
    const body: any = { action };
    if (sheet) body.sheet = sheet;
    if (data !== undefined) body.data = data;

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error('Google Sheets request failed: ' + res.status);
    return res.json();
  }

  private async doGet(action: string, sheet?: string): Promise<any> {
    const url = sheet
      ? `${this.baseUrl}?action=${action}&sheet=${sheet}`
      : `${this.baseUrl}?action=${action}`;
    const res = await fetch(url);
    return res.json();
  }

  async ping(): Promise<boolean> {
    try {
      const res = await this.doGet('ping');
      return res.status === 'ok';
    } catch {
      return false;
    }
  }

  async pullAll(): Promise<Record<SheetName, any[]>> {
    const result = await this.doGet('getAll');
    if (result.error) throw new Error(result.error);
    return result;
  }

  async pullSheet(sheet: SheetName): Promise<any[]> {
    const result = await this.doGet('getAll', sheet);
    if (result.error) throw new Error(result.error);
    return Array.isArray(result) ? result : [];
  }

  async pushSheet(sheet: SheetName, data: any[]): Promise<void> {
    await this.request('replace', sheet, data);
  }

  async insertRow(sheet: SheetName, data: any): Promise<void> {
    await this.request('insert', sheet, data);
  }

  async insertBatch(sheet: SheetName, data: any[]): Promise<void> {
    await this.request('insertBatch', sheet, data);
  }

  async updateRow(sheet: SheetName, id: string, data: any): Promise<void> {
    await this.request('update', sheet, { id, data });
  }

  async deleteRow(sheet: SheetName, id: string): Promise<void> {
    await this.request('delete', sheet, { id });
  }

  async syncFull(localData: Record<string, any[]>): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    try {
      for (const sheet of SHEET_NAMES) {
        if (localData[sheet] && localData[sheet].length > 0) {
          await this.pushSheet(sheet, localData[sheet]);
        }
      }
    } finally {
      this.syncing = false;
    }
  }

  isSyncing(): boolean {
    return this.syncing;
  }
}

export function createSyncInstance(url: string | null): GoogleSheetsSync | null {
  if (!url || !url.includes('script.google.com')) return null;
  return new GoogleSheetsSync(url);
}

export { SHEET_NAMES };
export type { SheetName };
