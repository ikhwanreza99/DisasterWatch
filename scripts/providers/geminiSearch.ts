// Server-only Google Search grounding. Never import this module in browser code.
import { newsSourceUrl } from '../../src/services/newsSourceUrl.ts';

export interface SearchHit {
  title: string;
  link: string;
  sourceName: string;
  summary: string | null;
  pubDate: string | null;
  searchSuggestions: string | null;
}
interface Citation { type?: string; url?: string; title?: string; start_index?: number; end_index?: number }
interface Block { type?: string; text?: string; annotations?: Citation[] }
interface SearchResponse {
  status?: string;
  steps?: Array<{ type?: string; content?: Block[]; result?: Array<{ search_suggestions?: string }> }>;
}

export function parseGroundedSearch(data: SearchResponse): SearchHit[] {
  if (data.status && data.status !== 'completed') throw new Error('Incomplete Google search');
  const steps = data.steps;
  if (!Array.isArray(steps) || !steps.some(s => s.type === 'google_search_call')) throw new Error('Google search not executed');
  const suggestions = steps.flatMap(s => s.type === 'google_search_result' ? s.result ?? [] : [])
    .map(r => r.search_suggestions).filter((s): s is string => typeof s === 'string').join('\n') || null;
  const hits = new Map<string, SearchHit>();
  for (const step of steps) {
    if (step.type !== 'model_output') continue;
    for (const block of step.content ?? []) {
      if (block.type !== 'text' || typeof block.text !== 'string') continue;
      for (const citation of block.annotations ?? []) {
        if (citation.type !== 'url_citation') continue;
        const link = newsSourceUrl(citation.url);
        if (!link || hits.has(link)) continue;
        const start = citation.start_index;
        const end = citation.end_index;
        // No uncited generated sentences, invented dates, or quantities.
        const summary = Number.isInteger(start) && Number.isInteger(end) && start! >= 0 && end! > start! && end! <= block.text.length
          ? block.text.slice(start, end).trim().slice(0, 1000) : null;
        const title = citation.title?.trim() || new URL(link).hostname;
        hits.set(link, { title, link, sourceName: new URL(link).hostname, summary, pubDate: null, searchSuggestions: suggestions });
      }
    }
  }
  return [...hits.values()].slice(0, 20);
}

export async function searchGemini(query: string, apiKey: string, model = 'gemini-3.8-flash', request: typeof fetch = fetch): Promise<SearchHit[]> {
  const response = await request('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ model, input: `Cari laporan bersumber tentang kejadian, kebutuhan bantuan pengungsi dan pemulihan utilitas sesuai query berikut: ${query}. Pertahankan batas lokasi dan tanggal query. Ringkas hanya informasi eksplisit dengan kutipan sumber. Jangan menebak jumlah, persentase, tanggal publikasi atau status terkini.`, tools: [{ type: 'google_search' }], store: false }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseGroundedSearch(await response.json() as SearchResponse);
}
