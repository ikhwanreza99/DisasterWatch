import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
