import React from 'react';
import { currentRecords } from '../../data/currentIncidents';

const fields = [
  ['deaths', 'Meninggal'], ['missing', 'Hilang'], ['injured', 'Terluka'],
  ['damagedHomes', 'Rumah rusak'], ['floodedHomes', 'Rumah terendam'],
  ['damagedFacilities', 'Fasum rusak'],
] as const;

export function BnpbImpactCard({ incidentId }: { incidentId: string }) {
  const record = currentRecords.find(r => r.id === incidentId);
  const reports = [...(record?.reports ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="my-3 min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-3" aria-label="Dampak tercatat BNPB">
      <h4 className="text-sm font-bold text-slate-900">Dampak tercatat · GIS BNPB</h4>
      {!reports.length && <p className="mt-2 text-xs text-slate-500">Data dampak BNPB belum tersedia untuk titik ini.</p>}
      {reports.map((report, index) => (
        <details key={index} open={index === 0} className="mt-2 border-t border-slate-200 pt-2">
          <summary className="cursor-pointer text-xs font-semibold text-slate-700">
            Laporan {new Date(report.date).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'})}
          </summary>
          <p className="mt-2 break-words text-[11px] text-slate-500">{report.location}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {fields.map(([key,label]) => <div key={key} className="min-w-0 rounded-xl bg-white p-2">
              <dt className="text-[11px] text-slate-500">{label}</dt>
              <dd className="mt-1 text-sm font-bold text-slate-900">{report.impact?.[key] == null ? 'Belum tersedia' : report.impact[key]!.toLocaleString('id-ID')}</dd>
            </div>)}
          </dl>
          <a className="mt-2 inline-block text-xs text-blue-600 underline" href={report.documentationUrl || record!.url} target="_blank" rel="noopener noreferrer">Sumber laporan BNPB</a>
        </details>
      ))}
      {!!reports.length && <p className="mt-2 text-[10px] text-slate-500">Kolom kosong berarti belum tersedia. Angka ditampilkan per laporan, tidak dijumlahkan antar laporan.</p>}
    </section>
  );
}
