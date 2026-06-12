import type { BatchLedgerEntry } from '../types';
import { daysUntilExpiry } from './helpers';

export interface FEFOAllocation {
  batchId: string;
  quantity: number;
  expiryDate: string;
}

export function allocateFEFO(
  batches: BatchLedgerEntry[],
  requestedQty: number
): FEFOAllocation[] | null {
  const eligible = batches
    .filter(b => b.balance > 0 && daysUntilExpiry(b.expiryDate) >= 0)
    .sort((a, b) => {
      const expiryDiff = daysUntilExpiry(a.expiryDate) - daysUntilExpiry(b.expiryDate);
      if (expiryDiff !== 0) return expiryDiff;
      if (a.dom !== b.dom) return new Date(a.dom).getTime() - new Date(b.dom).getTime();
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  let remaining = requestedQty;
  const allocations: FEFOAllocation[] = [];

  for (const batch of eligible) {
    if (remaining <= 0) break;
    const allocQty = Math.min(batch.balance, remaining);
    allocations.push({
      batchId: batch.batchId,
      quantity: allocQty,
      expiryDate: batch.expiryDate,
    });
    remaining -= allocQty;
  }

  if (remaining > 0) return null;

  return allocations;
}
