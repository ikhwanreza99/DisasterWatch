// Provider-reported counts observed in this browser, not project billing totals.
export interface TokenSample {
  at: string;
  model: string;
  transport: string;
  input: number | null;
  output: number | null;
  total: number;
}
const KEY = "disasterwatch.token-usage.v1";
export function readTokenUsage(): TokenSample[] {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(rows)
      ? rows
          .filter(
            (r) =>
              r && typeof r.at === "string" &&
              typeof r.model === "string" &&
              Number.isSafeInteger(r.total) && r.total >= 0 &&
              [r.input, r.output].every(n => n === null || (Number.isSafeInteger(n) && n >= 0)),
          )
          .slice(-500)
      : [];
  } catch {
    return [];
  }
}
export function recordTokenUsage(
  usage:
    | {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      }
    | undefined,
  model: string,
  transport: string,
) {
  if (
    !usage ||
    !Number.isSafeInteger(usage.totalTokenCount) ||
    usage.totalTokenCount! < 0
  )
    return;
  const sample: TokenSample = {
    at: new Date().toISOString(),
    model,
    transport,
    input: Number.isSafeInteger(usage.promptTokenCount) && usage.promptTokenCount! >= 0 ? usage.promptTokenCount! : null,
    output: Number.isSafeInteger(usage.candidatesTokenCount) && usage.candidatesTokenCount! >= 0 ? usage.candidatesTokenCount! : null,
    total: usage.totalTokenCount!,
  };
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify([...readTokenUsage(), sample].slice(-500)),
    );
    window.dispatchEvent(new Event("dw-token-usage"));
  } catch {
    /* Telemetry must never interrupt AI requests. */
  }
  void persistTokenSample(sample);
}

async function persistTokenSample(sample: TokenSample) {
  try {
    const [{ getApps }, { getAuth }, { getFirestore, collection, addDoc, serverTimestamp }] = await Promise.all([import("firebase/app"), import("firebase/auth"), import("firebase/firestore")]);
    const app = getApps().find(a => getAuth(a).currentUser);
    if (!app) return; // Anonymous/unauthenticated requests stay local.
    const uid = getAuth(app).currentUser!.uid;
    await addDoc(collection(getFirestore(app), "aiUsage"), { ...sample, source: "browser", uid, createdAt: serverTimestamp() });
  } catch {
    window.dispatchEvent(new Event("dw-token-sync-error"));
  }
}
