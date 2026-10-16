import {StrictMode, Suspense, lazy, type FC} from 'react';
import {createRoot} from 'react-dom/client';
const App = lazy(() => import('./App.tsx'));
import { LanguageProvider, useI18n } from './i18n';
import 'leaflet/dist/leaflet.css';
import './index.css';

// Early global listener for Google Maps authentication & referer errors
(window as any).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-auth-failure', {
    detail: { reason: 'RefererNotAllowedMapError' }
  }));
};

const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  origConsoleError.apply(console, args);
  const msg = args.map(a => String(a)).join(' ');
  if (msg.includes('RefererNotAllowedMapError') || msg.includes('Google Maps JavaScript API error')) {
    window.dispatchEvent(new CustomEvent('gmp-auth-failure', {
      detail: { reason: 'RefererNotAllowedMapError', raw: msg }
    }));
  }
};

const GoogleStatusPage = lazy(() => import('./components/GoogleStatusPage'));
const AdminPage = lazy(() => import('./admin/AdminPage'));
const isAdminPage = /^\/admin(?:\/|$)/.test(window.location.pathname);
const isStatusPage = ['/status', '/status/'].includes(window.location.pathname);

const LoadingFallback: FC = () => {
  const { t } = useI18n();
  return <div className="p-8 text-slate-500">{t('Memuat DisasterWatch...')}</div>;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <Suspense fallback={<LoadingFallback />}>{isAdminPage ? <AdminPage /> : isStatusPage ? <GoogleStatusPage /> : <App />}</Suspense>
    </LanguageProvider>
  </StrictMode>,
);
