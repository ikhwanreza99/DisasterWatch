import type { DisasterCheckpoint } from '../../types';
export interface FacilityPlace {id?:string;displayName?:{text?:string};formattedAddress?:string;location?:{latitude?:number;longitude?:number};types?:string[];businessStatus?:string;addressComponents?:Array<{longText?:string;types?:string[]}>}
export const FACILITY_TYPES = ['mosque','church','school','primary_school','secondary_school','park','stadium','sports_complex','community_center'];
/** Provider results are capped here and deduplicated, so the map never stacks markers on one point. */
export const MAX_CANDIDATES = 5;
// Google often pins several distinct venues to one shared plus-code/coordinate. Two
// "facilities" that close are one site on the map, so only the nearest is kept.
const MIN_SEPARATION_METERS = 50;
// When every candidate sits this close to the reference, the reference is a plus-code
// shared by many venues, not a real site: the caller should re-anchor to the reported area.
export const AMBIGUOUS_ANCHOR_METERS = 25;
export function isAmbiguousAnchor(candidates:DisasterCheckpoint[]):boolean {
  return candidates.length > 0 && candidates.every(candidate => (candidate.distanceMeters ?? Number.POSITIVE_INFINITY) <= AMBIGUOUS_ANCHOR_METERS);
}
/** Place-name tokens in a BNPB location string, admin keywords and punctuation stripped. */
export function areaWords(area:string):string[] {
  return area
    .replace(/\b(?:kecamatan|kec|kelurahan|kel|desa|ds|kabupaten|kab)\b\.?/gi,' ')
    .replace(/[^\p{L}\s]/gu,' ')
    .replace(/\s+/g,' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}
/**
 * Clean Places text queries for the reported area (never the raw BNPB string), most
 * specific first. A single-word name is retried because BNPB often appends a different
 * kelurahan; `placeInRegion` still guards the regency on whatever comes back.
 */
export function anchorQueries(area:string,incidentName:string,province:string):string[] {
  const words=areaWords(area);
  if(!words.length)return [];
  const prefix=/\b(?:kecamatan|kec)\b/i.test(area)?'Kecamatan ':'';
  const two=words[1]&&words[1]!==words[0]?`${words[0]} ${words[1]}`:null;
  return [...new Set([two,words[0]].filter(Boolean).map(leaf=>`${prefix}${leaf}, ${incidentName}, ${province}`))];
}
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
  }).sort((a,b)=>a.distanceMeters!-b.distanceMeters!)
    .filter((candidate,index,all)=>all.findIndex(other=>distanceMeters(candidate.lat!,candidate.lng!,other.lat!,other.lng!)<=MIN_SEPARATION_METERS)===index)
    .slice(0,MAX_CANDIDATES);
}
// Gemini can order existing IDs only; cannot invent a place, capacity, or coordinates.
export function rankCandidates(candidates:DisasterCheckpoint[],response:string):DisasterCheckpoint[] {
  const ids=JSON.parse(response.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
  if(!Array.isArray(ids) || ids.length!==candidates.length || new Set(ids).size!==ids.length || ids.some(id=>!Number.isInteger(id)||!candidates.some(c=>c.id===id)))throw new Error('Invalid Gemini facility ranking');
  return ids.map(id=>candidates.find(c=>c.id===id)!);
}

function regionName(value:string){return value.toLowerCase().replace(/\b(kabupaten|kab|kota|regency|city)\b/g,'').replace(/[^a-z0-9]/g,'');}
export function placeInRegion(place:FacilityPlace,name:string):boolean {
  const expected=regionName(name);
  const region=place.addressComponents?.find(c=>c.types?.includes('administrative_area_level_2'))?.longText;
  return !!expected && (region ? regionName(region)===expected : regionName(place.formattedAddress??'').includes(expected));
}
