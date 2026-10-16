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
    const hygienePax = /popok|pembalut|higiene|hygiene|sanitasi/i.test(f.item) && /^(pax|pak|pack)$/.test(unit);
    const kitchen = /kompor|panci|wajan|piring|gelas|sendok|teko|ember|spatula|gas/i.test(f.item) && /^(set|pcs|buah|unit|tabung)$/.test(unit);
    const personal = /selimut|baju|masker/i.test(f.item) && /^(pcs|lembar|buah|unit)$/.test(unit);
    const packageAid = unit === 'paket' && /sembako|pangan|makanan|beras|mie|mi instan|selimut|baju|higiene|hygiene|sanitasi/i.test(f.item);
    const boxedAid = /^(box|boks|dus|karton)$/.test(unit) && /air mineral|air minum|mie|mi instan|makanan|susu|biskuit|sarden|selimut|baju|masker/i.test(f.item);
    if (!meal && !personal && !packageAid && !boxedAid && !hygienePax && !kitchen) return [];
    // Explicit piece counts in the source take precedence over the 40-pc scenario.
    const contents = boxedAid ? f.item.match(/(?:isi\s*|@\s*)(\d+)\s*(?:pcs|buah|bungkus|botol|cup|kotak|kaleng)\b/i) : null;
    const factor = meal || personal || kitchen ? 1 : packageAid ? 30 : contents ? Number(contents[1]) : 40;
    if (!Number.isFinite(factor) || factor <= 0) return [];
    const received = f.quantity * factor;
    const allocationUnit = kitchen || (packageAid && !meal) ? 'jiwa' : meal ? 'porsi' : 'pcs';
    const assumption = hygienePax ? '1 pax = 40 pcs · 1 pcs/jiwa' : kitchen ? 'Jumlah barang = jiwa terlayani' : meal ? '1 porsi/jiwa · 1 kali makan' : packageAid ? '1 paket/30 jiwa' : boxedAid ? `1 ${unit} = ${factor} pcs · 1 pcs/jiwa${contents ? ' (isi dari sumber)' : ''}` : '1 barang/jiwa';
    return [{ fact: f, population, required: population, received, allocationUnit,
      perPerson: received / population, pct: Math.min(100, 100 * received / population), assumption,
      populationSources: populationFacts.filter(p => p.quantity === population) }];
  });
}


export const aidCategoryMatches: Record<string, RegExp> = {
 clean_water: /air|mineral/i, food: /beras|nasi|mie|sarden|minyak|telur|susu|biskuit/i,
 medicine: /obat|medis/i, shelter: /tenda|terpal/i, clothing: /selimut|baju/i,
 boat: /perahu|evakuasi/i, sanitation: /popok|pembalut|higiene|hygiene|sanitasi/i,
 mask: /masker/i, kitchen: /kompor|panci|wajan|piring|gelas|sendok|teko|ember|spatula|gas/i,
};

/** Scenario coverage, not verified infrastructure recovery. Missing categories count
 * as unfilled in the planning baseline; oversupply cannot cover another category. */
export function aggregateAidProgress(facts: NarrativeFact[], baseline: string[]) {
 const estimates = narrativeAidProgress(facts);
 const categories = [...new Set([...baseline, ...Object.keys(aidCategoryMatches).filter(c => facts.some(f => f.kind === 'DISTRIBUTED' && aidCategoryMatches[c].test(f.item)))])];
 const groups = categories.map(category => {
  const rows = estimates.filter(e => aidCategoryMatches[category]?.test(e.fact.item));
  const population = rows[0]?.population ?? null;
  const received = rows.reduce((sum, e) => sum + e.received, 0);
  return { category, population, received, pct: population ? Math.min(100, received / population * 100) : null };
 });
 const populated = groups.filter(g => g.pct !== null);
 return { groups, pct: populated.length && groups.length ? groups.reduce((sum,g) => sum + (g.pct ?? 0), 0) / groups.length : null,
  waterPct: populated.some(g => g.category === 'clean_water' || g.category === 'sanitation')
   ? ['clean_water', 'sanitation'].reduce((sum,c) => sum + (groups.find(g => g.category === c)?.pct ?? 0), 0) / 2 : null,
  populated: populated.length, total: groups.length };
}
