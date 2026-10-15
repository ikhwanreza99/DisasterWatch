export function elapsedIncidentDays(eventDate:string,now=new Date()){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const start=Date.parse(`${eventDate}T00:00:00+07:00`),end=Date.parse(`${today}T00:00:00+07:00`);
 return Number.isFinite(start)&&Number.isFinite(end)&&end>=start?Math.floor((end-start)/86400000):null;
}
export function estimateHousingDamage(homes:number,cost:number,severity:number){
 return Number.isInteger(homes)&&homes>=0&&Number.isFinite(cost)&&cost>=0&&Number.isFinite(severity)&&severity>=0&&severity<=1?homes*cost*severity:null;
}
export function validateSeverity(raw:string,articles:Array<{title:string;summary?:string;url:string}>){
 try{const parsed=JSON.parse(raw.replace(/```json|```/g,'').trim());const article=articles.find(a=>a.url===parsed.sourceUrl);
 const labels:Record<string,number>={ringan:.2,sedang:.5,berat:1};
 if(!article||typeof parsed.quote!=='string'||parsed.quote.length<12||!(article.title+' '+(article.summary??'')).includes(parsed.quote)||!(parsed.level in labels))return null;
 // The quoted text must actually discuss housing damage, not flood intensity or aid.
 if(!/rumah/i.test(parsed.quote)||!/rusak|hancur|roboh/i.test(parsed.quote))return null;
 return {severity:labels[parsed.level],level:parsed.level as string,quote:parsed.quote,sourceUrl:article.url};
 }catch{return null;}
}
