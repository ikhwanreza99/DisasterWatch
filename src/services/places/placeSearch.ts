// Area search via Google Places API (New): Autocomplete → Place Details (location + viewport).
// Uses the same browser key as Maps (VITE_GOOGLE_MAPS_API_KEY, referrer-restricted).
// A session token groups autocomplete + details into one billing session.
import { translate } from '../../i18n';

const API = 'https://places.googleapis.com/v1';

export interface PlaceSuggestion {
  placeId: string;
  primary: string; // e.g. "Semarang"
  secondary: string; // e.g. "Kota Semarang, Jawa Tengah, Indonesia"
}

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Suggested zoom from the place viewport size. */
  zoom: number;
}

function apiKey(): string {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
}

export function newSessionToken(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function call<T>(url: string, init: RequestInit, fieldMask: string, signal?: AbortSignal): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error(translate('Google Maps API key belum diisi'));
  const res = await fetch(url, {
    ...init,
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': fieldMask,
      ...(init.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!res.ok) throw new Error(json.error?.message?.slice(0, 140) || translate('Places HTTP {status}', { status: res.status }));
  return json;
}

/** Suggestions for `input`, biased to Indonesia. */
export async function autocompletePlaces(
  input: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const q = input.trim();
  if (q.length < 2) return [];
  type Resp = {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
        text?: { text?: string };
      };
    }[];
  };
  const json = await call<Resp>(
    `${API}/places:autocomplete`,
    {
      method: 'POST',
      body: JSON.stringify({ input: q, includedRegionCodes: ['id'], languageCode: 'id', sessionToken }),
    },
    'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text',
    signal,
  );
  return (json.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
    .slice(0, 6)
    .map((p) => ({
      placeId: p.placeId,
      primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      secondary: p.structuredFormat?.secondaryText?.text ?? '',
    }));
}

/** Zoom that roughly fits a viewport (degrees of latitude span). */
function zoomForSpan(latSpan: number): number {
  if (!Number.isFinite(latSpan) || latSpan <= 0) return 13;
  const z = Math.round(Math.log2(180 / latSpan));
  return Math.max(5, Math.min(16, z));
}

export async function getPlace(placeId: string, sessionToken: string, signal?: AbortSignal): Promise<PlaceResult> {
  type Resp = {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    viewport?: { low?: { latitude: number }; high?: { latitude: number } };
  };
  const json = await call<Resp>(
    `${API}/places/${encodeURIComponent(placeId)}?languageCode=id&sessionToken=${encodeURIComponent(sessionToken)}`,
    { method: 'GET' },
    'id,displayName,formattedAddress,location,viewport',
    signal,
  );
  if (!json.location) throw new Error(translate('Lokasi tempat tidak ditemukan'));
  const span =
    json.viewport?.high && json.viewport?.low ? json.viewport.high.latitude - json.viewport.low.latitude : NaN;
  return {
    placeId,
    name: json.displayName?.text ?? '',
    address: json.formattedAddress ?? '',
    lat: json.location.latitude,
    lng: json.location.longitude,
    zoom: zoomForSpan(span),
  };
}

/** One bounded Nearby Search for real public-facility candidates. */
export async function nearbyFacilities(lat:number,lng:number,radius:number):Promise<import('./evacuationCandidates').FacilityPlace[]> {
  const {FACILITY_TYPES}=await import('./evacuationCandidates');
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new Error(translate('Koordinat bencana belum valid'));
  const response=await call<{places?:import('./evacuationCandidates').FacilityPlace[]}>(`${API}/places:searchNearby`,{
    method:'POST',body:JSON.stringify({includedTypes:FACILITY_TYPES,maxResultCount:20,rankPreference:'POPULARITY',languageCode:'id',locationRestriction:{circle:{center:{latitude:lat,longitude:lng},radius}}}),
  },'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.businessStatus,places.addressComponents',AbortSignal.timeout(30000));
  return response.places??[];
}

export async function findReportedArea(textQuery:string):Promise<import('./evacuationCandidates').FacilityPlace[]> {
  const response=await call<{places?:import('./evacuationCandidates').FacilityPlace[]}>(`${API}/places:searchText`,{
    method:'POST',body:JSON.stringify({textQuery,languageCode:'id',regionCode:'ID',pageSize:5}),
  },'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.addressComponents',AbortSignal.timeout(30000));
  return response.places??[];
}
