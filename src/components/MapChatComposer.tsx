import React, { useRef, useState } from 'react';
import { Plus, Send, X } from 'lucide-react';

export function MapChatComposer({ onSend }: { onSend: (message: string, file?: File) => void }) {
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File>();
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <div className="w-[min(420px,calc(100vw-5rem))]" data-purpose="map-ai-composer">
      {file && <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700"><span className="truncate">{file.name}</span><button type="button" onClick={() => setFile(undefined)} aria-label="Hapus lampiran" className="shrink-0"><X className="h-4 w-4" /></button></div>}
      <div className="rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-pink-500 p-[2px] shadow-xl">
      <form className="flex h-11 items-center gap-1.5 rounded-full bg-white px-1.5" onSubmit={event => { event.preventDefault(); if (!message.trim() && !file) return; onSend(message.trim(), file); setMessage(''); setFile(undefined); }}>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={event => { const selected = event.target.files?.[0]; event.target.value = ''; if (!selected) return; if (selected.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(selected.type)) { setError('Pilih foto atau PDF dengan ukuran maksimal 5 MB.'); return; } setError(''); setFile(selected); }} />
        <button type="button" onClick={() => fileInput.current?.click()} aria-label="Tambahkan file atau gambar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-violet-50 hover:text-violet-600"><Plus className="h-4 w-4" /></button>
        <input type="text" aria-label="Mulai obrolan dengan Disaster AI" placeholder="Mulai obrolan dengan laporkan bencana atau pelajari" value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} className="h-full min-w-0 flex-1 bg-transparent py-0 text-xs leading-normal text-slate-700 outline-none placeholder:text-slate-400" />
        <button type="submit" disabled={!message.trim() && !file} aria-label="Kirim ke Disaster AI" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-pink-500 text-white shadow-md shadow-violet-500/25 transition-all hover:brightness-110 active:scale-95 disabled:opacity-100 disabled:cursor-default"><Send className="h-3.5 w-3.5" /></button>
      </form>
      </div>
      {error && <p role="alert" className="px-2 pt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
