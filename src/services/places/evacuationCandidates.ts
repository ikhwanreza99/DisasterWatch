import type { DisasterCheckpoint } from '../../types';
export interface FacilityPlace {id?:string;displayName?:{text?:string};formattedAddress?:string;location?:{latitude?:number;longitude?:number};types?:string[];businessStatus?:string}
export const FACILITY_TYPES = ['mosque','church','school','primary_school','secondary_school','park','stadium','sports_complex','community_center'];
export function distanceMeters(lat:number,lng:number,toLat:number,toLng:number) {
  const rad=Math.PI/180, a=Math.sin((toLat-lat)*rad/2)**2+Math.cos(lat*rad)*Math.cos(toLat*rad)*Math.sin((toLng-lng)*rad/2)**2;
  return Math.round(6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}
export function facilityCandidates(places:FacilityPlace[],lat:number,lng:number,radius:number):DisasterCheckpoint[] {
  const seen=new Set<string>();
  return places.flatMap((place,index)=>{
    const location=place.location, name=place.displayName?.text?.trim();
    if(!place.id || seen.has(place.id) || !name || !location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) || Math.abs(location.latitude!)>90 || Math.abs(location.longitude!)>180 || place.businessStatus?.startsWith('CLOSED') || !place.types?.some(t=>FACILITY_TYPES.includes(t)))return [];
    const distance=distanceMeters(lat,lng,location.latitude!,location.longitude!);
    if(distance>radius)return [];
    seen.add(place.id);
    const type=place.types.includes('mosque')?'Masjid':place.types.includes('church')?'Gereja':place.types.some(t=>t.includes('school'))?'Sekolah':place.types.includes('community_center')?'Balai warga':'Lapangan / fasilitas olahraga';
    return [{id:-(index+1),name,location:place.formattedAddress??'Alamat belum tersedia',lat:location.latitude,lng:location.longitude,placeId:place.id,recommendation:true,facilityType:type,distanceMeters:distance,googleMapsUrl:`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}&query_place_id=${encodeURIComponent(place.id)}`,tag:'Usulan fasum',capacityStatus:'Belum Ada Data' as const,subtitle:'Kapasitas, akses, izin pengelola, dan keamanan lokasi perlu diperiksa BPBD.'}];
  }).sort((a,b)=>a.distanceMeters!-b.distanceMeters!);
}
// Gemini can order existing IDs only; cannot invent a place, capacity, or coordinates.
export function rankCandidates(candidates:DisasterCheckpoint[],response:string):DisasterCheckpoint[] {
  const ids=JSON.parse(response.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
  if(!Array.isArray(ids) || ids.length!==candidates.length || new Set(ids).size!==ids.length || ids.some(id=>!Number.isInteger(id)||!candidates.some(c=>c.id===id)))throw new Error('Invalid Gemini facility ranking');
  return ids.map(id=>candidates.find(c=>c.id===id)!);
}
