import type { BatchLedgerEntry } from '../types';

export interface FIFOAllocation {
  batchId: string;
  quantity: number;
}

export function allocateFIFO(
  batches: BatchLedgerEntry[],
  requestedQty: number
): FIFOAllocation[] | null {
  const eligible = batches
    .filter(b => b.balance > 0)
    .sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  let remaining = requestedQty;
  const allocations: FIFOAllocation[] = [];

  for (const batch of eligible) {
    if (remaining <= 0) break;
    const allocQty = Math.min(batch.balance, remaining);
    allocations.push({
      batchId: batch.batchId,
      quantity: allocQty,
    });
    remaining -= allocQty;
  }

  if (remaining > 0) return null;

  return allocations;
}
