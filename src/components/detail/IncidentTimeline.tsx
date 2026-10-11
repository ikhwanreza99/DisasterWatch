// Shared chronological timeline (event vs publish vs retrieval kept distinct).
import React from 'react';

export interface DetailTimelineEvent {
  id: string;
  kind: string;
  at: string | null;
  label: string;
  detail: string;
  sourceUrl: string | null;
}

function fmt(iso: string | null): string {
  if (!iso) return 'Waktu tidak tersedia';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'Waktu tidak tersedia';
  return new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
}

export const IncidentTimeline: React.FC<{ events: DetailTimelineEvent[] }> = ({ events }) => {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-[11px] text-slate-500" data-testid="timeline-empty">
        Belum ada peristiwa timeline untuk insiden ini.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3" data-testid="timeline">
      <h4 className="text-xs font-bold text-slate-900">Timeline insiden</h4>
      <ol className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3">
        {events.map((e) => (
          <li key={e.id} className="text-[11px]">
            <p className="font-bold text-slate-800">
              <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600">{e.kind}</span>
              {e.label}
            </p>
            <p className="text-slate-500">{fmt(e.at)} · {e.detail}</p>
            {e.sourceUrl && e.sourceUrl.startsWith('http') && (
              <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Buka sumber</a>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
};
