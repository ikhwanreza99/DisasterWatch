import type { NarrativeFact } from './articleNarrative';
// Planning assumptions requested by the user; quantities in source facts stay intact.
export function narrativeAidProgress(facts: NarrativeFact[]) {
  const populationFacts = facts.filter(f => f.kind === 'IMPACT' && /^(jiwa|orang|warga)$/i.test(f.unit) && Number.isFinite(f.quantity) && f.quantity > 0);
  const population = populationFacts.length ? Math.max(...populationFacts.map(f => f.quantity)) : null;
  const seen = new Set<string>();
  return facts.filter(f => f.kind === 'DISTRIBUTED' && Number.isFinite(f.quantity) && f.quantity > 0).flatMap(f => {
    const key = `${f.organization ?? f.sourceUrl}|${f.item.toLowerCase()}|${f.unit}|${f.quantity}`;
    if (seen.has(key)) return [];
    seen.add(key);
    // Age-specific aid needs the size of that group, not the entire population.
    if (!population || /anak|bayi/i.test(f.item)) return [];
    const unit = f.unit.trim().toLowerCase();
    const meal = /nasi|makanan siap|siap (?:saji|konsumsi)/i.test(f.item) && /^(bungkus|pax|porsi|paket)$/.test(unit);
    const personal = /selimut|baju|masker/i.test(f.item) && /^(pcs|lembar|buah|unit)$/.test(unit);
    const packageAid = unit === 'paket' && /sembako|pangan|makanan|beras|mie|mi instan|selimut|baju|higiene|hygiene|sanitasi/i.test(f.item);
    const boxedAid = /^(box|boks|dus|karton)$/.test(unit) && /air mineral|air minum|mie|mi instan|makanan|susu|biskuit|sarden|selimut|baju|masker/i.test(f.item);
    if (!meal && !personal && !packageAid && !boxedAid) return [];
    // Explicit piece counts in the source take precedence over the 40-pc scenario.
    const contents = boxedAid ? f.item.match(/(?:isi\s*|@\s*)(\d+)\s*(?:pcs|buah|bungkus|botol|cup|kotak|kaleng)\b/i) : null;
    const factor = meal || personal ? 1 : packageAid ? 30 : contents ? Number(contents[1]) : 40;
    if (!Number.isFinite(factor) || factor <= 0) return [];
    const received = f.quantity * factor;
    const allocationUnit = packageAid && !meal ? 'jiwa' : meal ? 'porsi' : 'pcs';
    const assumption = meal ? '1 porsi/jiwa · 1 kali makan' : packageAid ? '1 paket/30 jiwa' : boxedAid ? `1 ${unit} = ${factor} pcs · 1 pcs/jiwa${contents ? ' (isi dari sumber)' : ''}` : '1 barang/jiwa';
    return [{ fact: f, population, required: population, received, allocationUnit,
      perPerson: received / population, pct: Math.min(100, 100 * received / population), assumption,
      populationSources: populationFacts.filter(p => p.quantity === population) }];
  });
}
