import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export async function recordServerUsage(db: Firestore | null, usage: {promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number} | undefined, model: string, transport: string) {
  if (!db || !usage || !Number.isSafeInteger(usage.totalTokenCount) || usage.totalTokenCount! < 0) return;
  const count = (n: number | undefined) => Number.isSafeInteger(n) && n! >= 0 ? n! : null;
  try {
    await db.collection('aiUsage').add({at:new Date().toISOString(), createdAt:FieldValue.serverTimestamp(), model, transport, source:'crawler', uid:null, input:count(usage.promptTokenCount), output:count(usage.candidatesTokenCount), total:usage.totalTokenCount});
  } catch { console.warn('aiUsage write failed; AI result preserved.'); }
}
