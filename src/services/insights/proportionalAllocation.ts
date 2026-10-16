export interface AllocationPoint {id:string;weight:number}
// Largest-remainder allocation preserves aggregate counts without rounding inflation.
export function allocateAggregate(total:number|null,points:AllocationPoint[]){
 if(total===null||!Number.isInteger(total)||total<0||!points.length||points.some(p=>!Number.isFinite(p.weight)||p.weight<=0)||new Set(points.map(p=>p.id)).size!==points.length)return null;
 const sum=points.reduce((s,p)=>s+p.weight,0);
 const rows=points.map(p=>({id:p.id,share:p.weight/sum,value:Math.floor(total*p.weight/sum),remainder:total*p.weight/sum%1}));
 let left=total-rows.reduce((s,p)=>s+p.value,0);
 for(const row of [...rows].sort((a,b)=>b.remainder-a.remainder||a.id.localeCompare(b.id))){if(left--<=0)break;row.value++;}
 return rows.map(({id,share,value})=>({id,share,value}));
}
