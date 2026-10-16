/** Public links open the same helpdesk/report panel used by the homepage. */
export function initialAiWorkflow(pathname: string): 'menu' | 'report-disaster' | null {
 const path = pathname.replace(/\/+$/, '') || '/';
 if (path === '/helpdesk') return 'menu';
 if (path === '/lapor') return 'report-disaster';
 return null;
}
