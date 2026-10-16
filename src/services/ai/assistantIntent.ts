/** Bilingual intent vocabulary for the limited, offline data assistant.
 * This is deliberately separate from location resolution: place names stay intact.
 */
export function normalizeAssistantQuestion(question: string): string {
  let value = question.toLowerCase();
  const phrases: Array<[RegExp, string]> = [
    [/\b(?:clean|drinking) water\b/g, 'air bersih'],
    [/\b(?:today|this day)\b/g, 'hari ini'],
    [/\b(?:affected people|people affected|people are affected|affected population|displaced people|evacuees)\b/g, 'orang terdampak'],
    [/\b(?:death toll|fatalities|deaths|people died|killed)\b/g, 'korban meninggal'],
    [/\b(?:how many people|how many victims|population)\b/g, 'berapa orang terdampak'],
    [/\b(?:how many disasters|how many incidents|any disasters?|what disasters?|list disasters?|are there disasters?)\b/g, 'daftar bencana'],
    [/\b(?:which|what) (?:region|area|city|cities|district)s?\b|\bwhere\b/g, 'wilayah mana'],
    [/\b(?:details?|tell me about|what happened|what is happening|information about)\b/g, 'detail'],
    [/\b(?:floods?|flooding)\b/g, 'banjir'], [/\bearthquakes?\b/g, 'gempa'],
    [/\b(?:wildfires?|fires?)\b/g, 'kebakaran'], [/\blandslides?\b/g, 'longsor'],
    [/\b(?:needs?|require[sd]?|required|supplies)\b/g, 'kebutuhan'],
    [/\b(?:lack|lacking|shortage|shortfall)\b/g, 'kekurangan'],
    [/\b(?:largest|greatest|most)\b/g, 'terbesar'], [/\b(?:aid|assistance|relief)\b/g, 'bantuan'],
    [/\b(?:latest|updates?|recent news|developments?)\b/g, 'terbaru'],
    [/\b(?:causes?|why)\b/g, 'penyebab'], [/\b(?:risks?|hazards?|dangers?)\b/g, 'risiko'],
    [/\b(?:evacuate|evacuation)\b/g, 'evakuasi'], [/\b(?:stay safe|protect|mitigation|safety)\b/g, 'mitigasi'],
    [/\b(?:when|what time|date)\b/g, 'kapan'], [/\b(?:losses|cost|economic damage)\b/g, 'kerugian'],
    [/\b(?:priority|priorities|urgent)\b/g, 'prioritas'], [/\b(?:unverified|verification)\b/g, 'verifikasi'],
    [/\b(?:summary|overview|current situation|current conditions)\b/g, 'ringkasan'],
    [/\breports?\b/g, 'laporan'], [/\b(?:how much|how many)\b/g, 'berapa'],
  ];
  for (const [pattern, replacement] of phrases) value = value.replace(pattern, replacement);
  return value;
}

export function asksForIncidentList(question: string): boolean {
  const q = normalizeAssistantQuestion(question);
  return /daftar bencana|berapa (?:bencana|insiden|kejadian)|bencana (?:apa|hari ini)|ada.*bencana|insiden aktif/.test(q);
}
export const asksForDetails = (question: string) => /detail|ceritakan|jelaskan.*(?:bencana|banjir|gempa|kebakaran)|gimana kondisi|bagaimana kondisi/.test(normalizeAssistantQuestion(question));
export const asksAboutToday = (question: string) => /\bhari ini\b/.test(normalizeAssistantQuestion(question));
