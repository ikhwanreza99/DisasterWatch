import React, { useState } from 'react';
import { X, HeartHandshake, CheckCircle2, Shield, Droplets, Pill, Package } from 'lucide-react';
import { DisasterIncident } from '../types';
import type { AidRecord } from '../domain/intelligence';
import { newId, nowIso } from '../domain/intelligence';
import { saveAid } from '../services/store/disasterStore';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  disaster: DisasterIncident;
  onAidAdded?: (aid: AidRecord) => void;
}

const AID_CATEGORY_MAP: Record<string, string> = {
  'Masker N95': 'mask',
  'Tangki Air Bersih': 'clean_water',
  'Paket Obat ISPA': 'medicine',
  'Paket Sembako': 'food',
};

export const DonationModal: React.FC<DonationModalProps> = ({
  isOpen,
  onClose,
  disaster,
  onAidAdded,
}) => {
  const [selectedAid, setSelectedAid] = useState<string>('Masker N95');
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [amountOrQuantity, setAmountOrQuantity] = useState('100 Pcs');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(amountOrQuantity.replace(/[^0-9]/g, ''), 10);
    const record: AidRecord = {
      id: newId('AID'),
      disasterId: disaster.id,
      needCategory: AID_CATEGORY_MAP[selectedAid] ?? 'food',
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      unit: /liter|l\b/i.test(amountOrQuantity) ? 'L' : /pcs|box/i.test(amountOrQuantity) ? 'pcs' : 'paket',
      sourceName: donorName || 'Donatur',
      receivedAt: nowIso(),
      isMock: true,
    };
    try {
      await saveAid(record);
    } catch {
      // local fallback already handled in store
    }
    onAidAdded?.(record);
    setIsSuccess(true);
  };

  const aidOptions = [
    { name: 'Masker N95', icon: <Shield className="w-4 h-4 text-rose-500" /> },
    { name: 'Tangki Air Bersih', icon: <Droplets className="w-4 h-4 text-blue-500" /> },
    { name: 'Paket Obat ISPA', icon: <Pill className="w-4 h-4 text-emerald-500" /> },
    { name: 'Paket Sembako', icon: <Package className="w-4 h-4 text-amber-500" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative overflow-hidden text-xs">
        {!isSuccess ? (
          <>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Salurkan Bantuan / Donasi</h3>
                  <p className="text-[11px] text-slate-500">{disaster.name}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Pilih Jenis Bantuan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {aidOptions.map((opt) => (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => setSelectedAid(opt.name)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer text-left ${
                        selectedAid === opt.name
                          ? 'border-orange-500 bg-orange-50/60 font-bold text-orange-950 ring-1 ring-orange-400'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {opt.icon}
                      <span className="truncate">{opt.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Jumlah / Kuantitas Bantuan
                </label>
                <input
                  type="text"
                  required
                  value={amountOrQuantity}
                  onChange={(e) => setAmountOrQuantity(e.target.value)}
                  placeholder="Contoh: 200 Box atau Rp 500.000"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Nama Donatur / Komunitas
                  </label>
                  <input
                    type="text"
                    required
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder="Nama Lengkap"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    No. WhatsApp / Kontak
                  </label>
                  <input
                    type="tel"
                    required
                    value={donorPhone}
                    onChange={(e) => setDonorPhone(e.target.value)}
                    placeholder="0812xxxx"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600">
                <span className="font-bold text-slate-800 block mb-0.5">Posko Drop-off Terdekat:</span>
                Gudang Satgas Terpadu BPBD — {disaster.route.checkpoints[0]?.title || 'Posko Komando Induk'}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-md shadow-orange-500/25 transition-all cursor-pointer"
                >
                  Konfirmasi Bantuan
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="py-6 px-2 text-center flex flex-col items-center justify-center space-y-3 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center border-2 border-emerald-300 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Komitmen Bantuan Diterima!</h4>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xs">
              Terima kasih <strong>{donorName}</strong>. Penyaluran bantuan <strong>{selectedAid}</strong> ({amountOrQuantity}) untuk <strong>{disaster.name}</strong> telah terdata di sistem logistik.
            </p>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-left w-full text-[10px] text-slate-500">
              Kode Konfirmasi: <strong className="text-slate-800">#DON-2026-{Math.floor(1000 + Math.random() * 9000)}</strong>
            </div>
            <button
              onClick={() => {
                setIsSuccess(false);
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Selesai & Tutup
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
