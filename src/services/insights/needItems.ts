export function needItems(hazard:string,category:string):string[]{
 const common:Record<string,string[]>={clean_water:['Air minum','Jeriken','Tangki air'],food:['Makanan siap saji','Beras','Dapur umum'],shelter:['Tenda','Terpal','Matras'],sanitation:['Hygiene kit','Toilet portabel','Pembalut & popok'],medicine:['P3K','Layanan medis','Oksigen medis (sesuai asesmen tenaga kesehatan)'],clothing:['Selimut','Pakaian layak pakai'],mask:['Masker partikulat yang sesuai','Pelindung mata'],boat:['Kendaraan evakuasi','Pelampung'],sar:['Peralatan SAR','Tim pencarian'],access:['Pembersihan jalan','Jembatan darurat'],repair:['Bahan bangunan','Peralatan perbaikan'],heavy:['Ekskavator','Alat pembuka akses'],kitchen:['Peralatan dapur','Logistik petugas'],livestock:['Pakan','Tempat evakuasi ternak']};
 if(hazard==='flood'&&category==='boat')return ['Perahu karet','Pelampung','Kendaraan evakuasi'];
 if(hazard==='flood'&&category==='drainage')return ['Pompa sedot','Selang pembuangan','Kantong pasir'];
 return common[category]??['Asesmen kebutuhan setempat'];
}
