import type { ServiceCheck } from './model';

/** Share in-flight checks (including React StrictMode), and reuse recent evidence. */
export function createCheckRunner(run: (id: string) => Promise<ServiceCheck>, now = Date.now, ttl = 10 * 60_000) {
  const cache = new Map<string, { at: number; promise: Promise<ServiceCheck> }>();
  let tail = Promise.resolve();
  return (id: string, force = false): Promise<ServiceCheck> => {
    const existing = cache.get(id);
    if (existing && now() - existing.at < ttl && !force) return existing.promise;
    // Serial probes avoid sending a burst of Gemini/Maps requests on page load.
    const promise = tail.then(() => run(id));
    tail = promise.then(() => {}, () => {});
    cache.set(id, { at: now(), promise });
    return promise;
  };
}
