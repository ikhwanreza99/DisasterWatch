import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { signInWithGoogle, previewUser } from '../lib/firebase/auth';
import { isFirebaseConfigured } from '../lib/firebase/config';
import { AUTH_UNAVAILABLE_MESSAGE, authErrorCode, mapAuthError } from '../lib/firebase/authErrors';
import type { LoginSource } from '../lib/firebase/authFlow';
import type { UserIdentity } from '../domain/intelligence';

interface LoginModalProps {
  onClose: () => void;
  onSuccess: (user: UserIdentity) => void;
  /** UI element that opened the modal; routes the user after sign-in. */
  source: LoginSource;
  /** Error from a completed redirect sign-in, shown when the modal opens. */
  initialError?: string;
}

export function LoginModal({ onClose, onSuccess, source, initialError = '' }: LoginModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const activeRef = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);

  useEffect(() => {
    activeRef.current = true;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { activeRef.current = false; dialog?.close(); };
  }, []);

  const handleLogin = () => {
    if (busy) return;
    // Mock mode (no Firebase env vars): preview session in DEV only, never real auth.
    if (!isFirebaseConfigured()) {
      if (import.meta.env.DEV) onSuccess(previewUser());
      else setError(AUTH_UNAVAILABLE_MESSAGE);
      return;
    }
    // Start sign-in synchronously inside the click so the popup keeps user activation.
    const pending = signInWithGoogle(source);
    setBusy(true);
    setError('');
    pending
      .then((outcome) => {
        if (!activeRef.current) return;
        if (outcome.status === 'redirecting') {
          // Page is navigating to Google; keep the button busy.
          setError('Mengalihkan ke halaman login Google…');
          return;
        }
        setBusy(false);
        onSuccess(outcome.user);
      })
      .catch((cause: unknown) => {
        if (!activeRef.current) return;
        // Raw code already logged in auth.ts.
        const code = authErrorCode(cause);
        setError(mapAuthError(code, cause instanceof Error && !code ? cause.message : undefined));
        setBusy(false);
      });
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="login-title"
      aria-describedby="login-description"
      onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm"
    >
      <button type="button" onClick={onClose} aria-label="Tutup login" className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-slate-100">
        <X className="h-4 w-4" />
      </button>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 via-violet-600 to-pink-500 text-white">
        <Sparkles className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 id="login-title" className="text-xl font-bold">{source === 'avatar' ? 'Masuk ke DisasterWatch' : 'Masuk untuk laporkan bencana'}</h2>
      <p id="login-description" className="mt-2 text-sm text-slate-500">{source === 'avatar'
        ? 'Gunakan akun Google untuk melaporkan bencana dan menyimpan laporan Anda.'
        : 'Gunakan akun Google. Setelah masuk, formulir laporan DisasterAI akan langsung terbuka.'}</p>
      <button type="button" onClick={handleLogin} disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.6Z"/><path fill="#34A853" d="M12 22c2.8 0 5.1-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1.9-3.5.9-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10.4 10.4 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.2 13.5a6.2 6.2 0 0 1 0-3V7.8H2.7a10 10 0 0 0 0 8.4l3.5-2.7Z"/><path fill="#EA4335" d="M12 6.2c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.9 9.9 0 0 0 12 2a10.4 10.4 0 0 0-9.3 5.8l3.5 2.7C7 8 9.3 6.2 12 6.2Z"/></svg>}
        {busy ? 'Menghubungkan…' : 'Masuk dengan Google'}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
    </dialog>
  );
}
