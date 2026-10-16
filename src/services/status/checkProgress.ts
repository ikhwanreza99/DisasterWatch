import type { ServiceCheck } from './model';

/** Count settled checks, including failures, rather than pretending all succeeded.
 * The backend step loads the latest report; it does not rerun server workflows.
 */
export function checkProgress(checks: ServiceCheck[], ids: string[], reportPending: boolean) {
  const total = ids.length + 1;
  const completed = ids.filter(id => {
    const check = checks.find(c => c.id === id);
    return check && !['checking', 'configured'].includes(check.state);
  }).length + (reportPending ? 0 : 1);
  return { total, completed, percent: Math.round(100 * completed / total) };
}
