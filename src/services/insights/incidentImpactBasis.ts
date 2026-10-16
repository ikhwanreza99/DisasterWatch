import {allCurrentRecords,currentRecords} from '../../data/currentIncidents';
import {NTT_CASE_ID} from '../../domain/nttCase';
export function latestImpactReport<T extends {date:string}>(reports:readonly T[]):T|undefined {
 return [...reports].sort((a,b)=>b.date.localeCompare(a.date))[0];
}
// Shared by both the reported impact card and the estimated physical loss.
export function incidentImpactBasis(incidentId:string){
 const record=(incidentId===NTT_CASE_ID?allCurrentRecords:currentRecords).find(r=>r.id===incidentId);
 const report=latestImpactReport(record?.reports??[]);
 const value=report?.impact?.damagedHomes;
 const homes=typeof value==='number'&&Number.isInteger(value)&&value>=0?value:null;
 return {record,report,homes};
}
