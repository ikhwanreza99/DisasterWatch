// Coarse jurisdiction sanity check, NOT proof of an exact disaster site.
import bounds from '../data/provinceBounds.json';
export const PROVINCE_BOUNDS: Record<string,number[]> = bounds;
export function locationValidation(record: {province?:string;lat?:number;lng?:number;coords?:{lat:number;lng:number}}) {
  const lat=record.coords?.lat ?? record.lat, lng=record.coords?.lng ?? record.lng;
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return {status:'REVIEW_REQUIRED',reason:'Koordinat belum tersedia.'};
  const bounds=PROVINCE_BOUNDS[record.province??''];
  if(!bounds)return {status:'REVIEW_REQUIRED',reason:'Batas provinsi belum dikenali; perlu validasi lokasi.'};
  if(lat!<bounds[0]||lat!>bounds[1]||lng!<bounds[2]||lng!>bounds[3])return {status:'REJECTED',reason:'Koordinat tidak cocok dengan wilayah provinsi.'};
  return {status:'REGION_CHECKED',reason:'Lolos pemeriksaan wilayah provinsi; titik kejadian/desa masih perlu fact-check.'};
}
