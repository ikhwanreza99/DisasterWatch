export class AdminError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function adminApi<T>(path: string, body?: unknown): Promise<T> {
  try {
    const { firebaseAdminApi } = await import('./firebaseApi');
    return await firebaseAdminApi(path, body) as T;
  } catch (error) {
    if ((error as {status?:number}).status === 401) throw new AdminError((error as Error).message,401);
    throw error;
  }
}
/** Legacy Express adapter kept for isolated server integration tests. */
export async function legacyAdminApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-DisasterWatch-Admin": "1",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => {
    throw new Error(
      "API admin belum tersedia. Jalankan server admin terlebih dahulu.",
    );
  });
  if (!response.ok)
    throw new AdminError(data.error || "Permintaan gagal.", response.status);
  return data;
}
export interface Page<T> {
  rows: T[];
  next: string | null;
  total: number;
  demo: boolean;
}
