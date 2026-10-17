import { useEvacuationPosts } from '../services/places/useEvacuationPosts';
import { useIncidentNarratives } from '../services/useIncidentNarratives';
import { postAllocation } from '../services/places/postAllocation';
import { PostCapacityEstimate } from './PostCapacityEstimate';
import React, { useState } from 'react';
import { X, HeartHandshake, CheckCircle2, Shield, Droplets, Pill, Package } from 'lucide-react';
import { DisasterIncident, type DisasterCheckpoint } from '../types';
import type { AidRecord } from '../domain/intelligence';
import { newId, nowIso } from '../domain/intelligence';
import { saveAid } from '../services/store/disasterStore';
import { useI18n } from '../i18n';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  disaster: DisasterIncident;
  onAidAdded?: (aid: AidRecord) => void;
  onSuggestedPosts?: (id:string,posts:DisasterCheckpoint[]) => void;
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
  onSuggestedPosts,
}) => {
  const { t } = useI18n();
  const [selectedAid, setSelectedAid] = useState<string>('Masker N95');
  const [customAid,setCustomAid]=useState('');
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [amountOrQuantity, setAmountOrQuantity] = useState('100 Pcs');
  const [isSuccess, setIsSuccess] = useState(false);
  const {posts,loading,error,refresh}=useEvacuationPosts(disaster,onSuggestedPosts,isOpen);
  const allocation=postAllocation(useIncidentNarratives(disaster.id));
  const [selectedPostId,setSelectedPostId]=useState<number|null>(null);
  const selectedPost=posts.find(p=>p.id===selectedPostId)??posts[0];
  const [submittedPostName,setSubmittedPostName]=useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!selectedPost)return;
    const qty = parseInt(amountOrQuantity.replace(/[^0-9]/g, ''), 10);
    const record: AidRecord = {
      id: newId('AID'),
      destinationPost: { id:selectedPost.id, name:selectedPost.name??selectedPost.title??t('Posko'), ...(selectedPost.placeId?{placeId:selectedPost.placeId}:{}), ...(selectedPost.location?{location:selectedPost.location}:{}), recommendation:!!selectedPost.recommendation },
      disasterId: disaster.id,
      needCategory: AID_CATEGORY_MAP[selectedAid] ?? 'other',
      itemName: selectedAid==='Lainnya'?customAid.trim():selectedAid,
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
    setSubmittedPostName(selectedPost.name??selectedPost.title??t('Posko'));
    setIsSuccess(true);
  };

  const aidOptions = [
    { name: 'Lainnya', icon: <Package className="w-4 h-4 text-slate-500" /> },
    { name: 'Masker N95', icon: <Shield className="w-4 h-4 text-rose-500" /> },
    { name: 'Tangki Air Bersih', icon: <Droplets className="w-4 h-4 text-blue-500" /> },
    { name: 'Paket Obat ISPA', icon: <Pill className="w-4 h-4 text-emerald-500" /> },
    { name: 'Paket Sembako', icon: <Package className="w-4 h-4 text-amber-500" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 animate-fadeIn">
      <div role="dialog" aria-modal="true" aria-labelledby="donation-title" className="bg-white max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative text-xs">
        {!isSuccess ? (
          <>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="donation-title" className="text-sm font-bold text-slate-900">{t('Salurkan Bantuan / Donasi')}</h3>
                  <p className="text-[11px] text-slate-500">{disaster.name}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label={t('Tutup form donasi')}
                className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  {t('Pilih Jenis Bantuan')}
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
                      <span className="truncate">{t(opt.name)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedAid==='Lainnya'&&<label className="block font-semibold text-slate-700 text-[11px]">{t('Nama bantuan lainnya')}<input required maxLength={200} value={customAid} onChange={e=>setCustomAid(e.target.value)} placeholder={t('Contoh: pompa sedot, perahu karet, perlengkapan bayi')} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"/></label>}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  {t('Jumlah / Kuantitas Bantuan')}
                </label>
                <input
                  type="text"
                  required
                  value={amountOrQuantity}
                  onChange={(e) => setAmountOrQuantity(e.target.value)}
                  placeholder={t('Contoh: 200 Box atau Rp 500.000')}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    {t('Nama Donatur / Komunitas')}
                  </label>
                  <input
                    type="text"
                    required
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder={t('Nama Lengkap')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    {t('No. WhatsApp / Kontak')}
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

              <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px]">
                <legend className="px-1 font-bold text-slate-800">{t('Pilih Posko Drop-off')}</legend>
                {loading && <p role="status" className="text-slate-500">{t('Memuat daftar Posko Bantuan…')}</p>}
                {error && <p role="alert" className="text-rose-700">{t('Daftar posko gagal dimuat.')} <button type="button" onClick={refresh} className="underline">{t('Coba lagi')}</button></p>}
                {!loading&&!error&&!posts.length&&<p className="text-slate-500">{t('Belum ada posko yang tersedia untuk wilayah ini.')} <button type="button" onClick={refresh} className="underline">{t('Coba lagi')}</button></p>}
                <div className="space-y-2">{posts.map(post=><label key={post.id} className={`flex cursor-pointer gap-2 rounded-xl border bg-white p-2.5 ${selectedPost?.id===post.id?'border-orange-400':'border-slate-200'}`}>
                  <input type="radio" name="destinationPost" value={post.id} checked={selectedPost?.id===post.id} onChange={()=>setSelectedPostId(post.id)} className="mt-1 shrink-0 accent-orange-600"/>
                  <span className="min-w-0"><span className="block font-semibold text-slate-800">{post.name??post.title}</span><span className="mt-0.5 block break-words text-[10px] text-slate-500">{post.location??(post.subtitle?t(post.subtitle):'')}</span>
                  <span className="mt-1 block text-[10px] text-amber-800">{post.recommendation?t('Usulan lokasi posko'):t('Posko Bantuan')}</span>
                  {post.googleMapsUrl&&<a href={post.googleMapsUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-blue-600 underline">{t('Lihat di Google Maps')}</a>}</span>
                </label>)}</div>
                {posts.some(post=>post.recommendation)&&<p className="mt-2 text-[10px] text-slate-500">{t('Usulan lokasi; konfirmasi operasional sebelum mengantar bantuan.')}</p>}
                {allocation&&<div className="mt-2"><PostCapacityEstimate estimate={allocation}/></div>}
              </fieldset>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {t('Batal')}
                </button>
                <button
                  type="submit"
                  disabled={!selectedPost}
                  className="disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-md shadow-orange-500/25 transition-all cursor-pointer"
                >
                  {t('Konfirmasi Bantuan')}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="py-6 px-2 text-center flex flex-col items-center justify-center space-y-3 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center border-2 border-emerald-300 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-900">{t('Komitmen Bantuan Diterima!')}</h4>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xs">
              {t('Terima kasih')} <strong>{donorName}</strong>{t('. Penyaluran bantuan')} <strong>{selectedAid==='Lainnya'?customAid:t(selectedAid)}</strong>{' '}{t('({qty}) untuk', { qty: amountOrQuantity })} <strong>{disaster.name}</strong> {t('telah terdata di sistem logistik.')}
            </p>
            <p className="text-xs font-semibold text-slate-700">{t('Posko tujuan: {name}',{name:submittedPostName})}</p>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-left w-full text-[10px] text-slate-500">
              {t('Kode Konfirmasi:')} <strong className="text-slate-800">#DON-2026-{Math.floor(1000 + Math.random() * 9000)}</strong>
            </div>
            <button
              onClick={() => {
                setIsSuccess(false);
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {t('Selesai & Tutup')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
