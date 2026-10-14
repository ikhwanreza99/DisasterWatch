# Import a downloaded BNPB table and region coordinate CSV; never invent missing coordinates.
# Usage: python3 scripts/importBnpbSnapshot.py table.html coordinates.csv 2026-10-12
import csv,re,json,html,sys
from datetime import date,datetime,timedelta
from zoneinfo import ZoneInfo
end=date.fromisoformat(sys.argv[3]) if len(sys.argv)>3 else datetime.now(ZoneInfo('Asia/Jakarta')).date()
start=end-timedelta(days=6)
from pathlib import Path
norm=lambda s: re.sub(r'[^a-z]','',re.sub(r'^kabupaten\s+','',s.lower()))
coord_groups={}
for entry in csv.DictReader(open(sys.argv[2])):coord_groups.setdefault(norm(entry['name']),[]).append(entry)
bounds=json.loads(Path('src/data/provinceBounds.json').read_text())

rows=[]
for tr in re.findall(r'<tr[^>]*>(.*?)</tr>',Path(sys.argv[1]).read_text(),re.S|re.I):
 cells=re.findall(r'<td[^>]*>(.*?)</td>',tr,re.S|re.I)
 c=[html.unescape(re.sub('<[^>]+>','',a)).strip() for a in re.findall(r'<td[^>]*>(.*?)</td>',tr,re.S|re.I)]
 if len(c)>8 and start.isoformat()<=c[3]<=end.isoformat():
  link=re.search(r'href=[\"\'](https://[^\"\']+)',cells[8],re.I)
  c.append(html.unescape(link.group(1)) if link else None)
  rows.append(c)
def count(value):
 value=value.strip()
 if not value: return None
 if not re.fullmatch(r'[0-9]+(?:[.,][0-9]{3})*', value):
  raise ValueError(f'Invalid impact count: {value!r}')
 return int(value.replace('.','').replace(',',''))
missing=[]; groups={}
for r in rows:
 key=(r[2],r[4]); groups.setdefault(key,[]).append(r)
records=[]
categories={'BANJIR':'flood','KEBAKARAN HUTAN DAN LAHAN':'fire','GEMPABUMI':'earthquake','KEKERINGAN':'other','TANAH LONGSOR':'landslide'}
for (code,kind),rr in groups.items():
 r=rr[0]; matches=coord_groups.get(norm(r[6]),[])
 matches=[co for co in matches if not co.get('province') or norm(co['province'])==norm(r[7])]
 if len(matches)!=1:missing.append(r[6]+' (missing/ambiguous name + province)');continue
 co=matches[0]; region=bounds.get(r[7]); latitude=float(co['lat']); longitude=float(co['long'])
 if not region or not(region[0]<=latitude<=region[1] and region[2]<=longitude<=region[3]):missing.append(r[6]+' (coordinates outside province)');continue
 cat=categories.get(kind, 'other'); id=f"bnpb-{code}-{cat}-{end.strftime('%Y-%m')}"
 if code=='1371':id='padang'
 if code=='5318' and kind=='GEMPABUMI' and any(x[3]=='2026-10-04' for x in rr):id='ntt-sumba-barat-daya-2026-10-04'
 if code=='1301':id='pesisir-selatan-2026-10'
 if code=='9301':id='merauke-2026-10'
 if code=='1116':id='aceh-tamiang-2026-10'
 records.append(dict(id=id,name=r[6],province=r[7],category=cat,disasterLabel=kind.title(),date=max(x[3] for x in rr),startDate=min(x[3] for x in rr),lat=float(co['lat']),lng=float(co['long']),aliases=[r[6]],source='BNPB',url='https://gis.bnpb.go.id/databencana/tabel/pencarian.php',summary=f'{len(rr)} laporan {kind.lower()} di {r[6]} pada {start.isoformat()}–{end.isoformat()}.',reports=[dict(date=x[3],location=x[5].replace('\\n',' ').strip(),documentationUrl=x[-1],impact=dict(zip(['deaths','missing','injured','damagedHomes','floodedHomes','damagedFacilities'],[count(v) for v in x[10:16]]))) for x in rr]))
print('missing',missing,'groups',len(groups),'mapped',len(records))
if not records: raise SystemExit('No matching reports; previous snapshot preserved')
if missing: raise SystemExit('Missing coordinates; previous snapshot preserved')
Path('src/data/nationalIncidents.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
