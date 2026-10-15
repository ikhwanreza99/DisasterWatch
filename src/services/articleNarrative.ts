export interface NarrativeFact {
  kind:'DISTRIBUTED'|'NEEDED'|'CAPACITY'|'AID_VALUE'|'LOSS'|'BENEFICIARIES';
  item:string; quantity:number; unit:string; sourceUrl:string; sourceName:string;
  publishedAt:string; organization:string|null;
}
export interface NarrativeArticle {url:string;sourceName:string;publishedAt:string;title:string;paragraphs:string[]}
const number=(value:string)=>Number(value.replace(/\./g,'').replace(',','.'));
export function extractNarrativeFacts(article:NarrativeArticle):NarrativeFact[] {
  const facts:NarrativeFact[]=[];
  const all=article.paragraphs.join(' ');
  const organization=/pertamina/i.test(article.title)?'Pertamina':/\bbni\b/i.test(article.title)?'BNI':null;
  const benefit=all.match(/penerima manfaat[^.]{0,40}?([\d.,]+)\s*(jiwa|orang)/i);
  const base={sourceUrl:article.url,sourceName:article.sourceName,publishedAt:article.publishedAt,organization};
  if(benefit)facts.push({...base,kind:'BENEFICIARIES',item:'Perkiraan penerima manfaat bantuan',quantity:number(benefit[1]),unit:benefit[2]});
  for(const paragraph of article.paragraphs){
    if(!/bantuan|disalur|distribusi|mencakup|tersebut|butuh|kekurangan|kerugian/i.test(paragraph))continue;
    const needed=/\b(dibutuhkan|membutuhkan|kekurangan)\b/i.test(paragraph) && !/disalur|distribusi/i.test(paragraph);
    const capacity=paragraph.match(/(?:tangki|tanki)[^.;]{0,50}?berkapasitas\s*([\d.,]+)\s*liter\s+air bersih/i);
    if(capacity)facts.push({...base,kind:'CAPACITY',item:'Kapasitas tangki air bersih',quantity:number(capacity[1]),unit:'liter'});
    const parts=paragraph.split(/,(?=\s*\d+\s*(?:dus|karung|kaleng|papan|paket|bungkus|pcs|pax|set|tabung|liter|kg|unit)\b)|,(?!\d)|;|\s+serta\s+/i);
    for(const part of parts){
      const m=part.match(/\b(\d[\d.,]*)\s*(dus|karung|kaleng|papan|paket|bungkus|pcs|pax|set|tabung|liter|kg|unit)\s+([^.;]{2,100})/i);
      if(!m || /berkapasitas/i.test(part))continue;
      const item=m[3].replace(/\s+(?:serta|dan)\s+(?:satu|sebuah|yang).*$/i,'').replace(/\s+yang.*$/i,'').trim();
      if(!/air|mineral|mie|mi instan|minyak|sarden|beras|telur|susu|biskuit|selimut|baju|pembalut|popok|kompor|panci|wajan|piring|gelas|sendok|teko|ember|spatula|gas|nasi|obat|masker|tenda/i.test(item))continue;
      facts.push({...base,kind:needed?'NEEDED':'DISTRIBUTED',item:item.slice(0,100),quantity:number(m[1]),unit:m[2].toLowerCase()});
    }
    // Money describing assistance is not a disaster-loss estimate.
    const money=paragraph.match(/Rp\s*([\d.,]+)\s*(juta|jut\b|miliar|milyar)/i);
    if(money){
      const kind=/kerugian|kerusakan[^.]{0,40}(?:mencapai|senilai)/i.test(paragraph)?'LOSS':/bantuan/i.test(paragraph)?'AID_VALUE':null;
      if(kind)facts.push({...base,kind,item:kind==='LOSS'?'Kerugian dilaporkan':'Perkiraan nilai bantuan',quantity:number(money[1])*(/^mi/i.test(money[2])?1e9:1e6),unit:'Rp'});
    }
  }
  // Require article-level location and event identity before retaining facts.
  if(/padang panjang/i.test(article.title) || !/\bpadang\b/i.test(article.title) || !/banjir/i.test(article.title) || !/kota padang|banjir (?:di )?padang/i.test(all))return [];
  const seen=new Set<string>();
  return facts.filter(f=>Number.isFinite(f.quantity)&&f.quantity>0&&!seen.has(`${f.kind}|${f.item}|${f.quantity}|${f.unit}`)&&!!seen.add(`${f.kind}|${f.item}|${f.quantity}|${f.unit}`));
}
export function reportedGap(facts:NarrativeFact[],item:string,unit:string) {
  // Never sum deliveries across articles: syndicated or overlapping reports may duplicate events.
  const needs=facts.filter(f=>f.kind==='NEEDED'&&f.item.toLowerCase()===item.toLowerCase()&&f.unit===unit);
  const received=facts.filter(f=>f.kind==='DISTRIBUTED'&&f.item.toLowerCase()===item.toLowerCase()&&f.unit===unit);
  if(needs.length!==1||received.length!==1||needs[0].sourceUrl!==received[0].sourceUrl)return null;
  return Math.max(0,needs[0].quantity-received[0].quantity);
}
