// DisasterWatch methodology v1.0. Missing inputs are never zero.
//
// This module is the SINGLE source of truth for disaster arithmetic.
// - Legacy `Measure`/`Result` helpers below are preserved for existing UI/tests.
// - The `CalculationResult` envelope (deterministic contract) adds production
//   requirements: invalid_input status, input values+units, source refs +
//   observation timestamps, assumptions/exclusions, calculation timestamp,
//   warnings/errors/trace. New code should prefer the `estimate*` functions.
export const METHOD_VERSION='disaster-insights-v1.0';
export interface Measure { value:number; unit:string; area:string; period:string; factIds:string[] }
export interface Result { value:number|null; unit:string; status:'calculated'|'insufficient_data'; methodVersion:string; inputFactIds:string[]; missingInputs:string[] }
const valid=(m:Measure|null|undefined)=>!!m&&Number.isFinite(m.value)&&m.value>=0&&!!m.area&&!!m.period&&m.factIds.length>0;
export function compatible(a:Measure|null|undefined,b:Measure|null|undefined){return valid(a)&&valid(b)&&a!.unit===b!.unit&&a!.area===b!.area&&a!.period===b!.period;}
function result(value:number|null,unit:string,inputs:Array<Measure|null|undefined>,missingInputs:string[]=[]):Result{return {value,unit,status:value===null?'insufficient_data':'calculated',methodVersion:METHOD_VERSION,inputFactIds:[...new Set(inputs.flatMap(m=>m?.factIds??[]))],missingInputs};}
export function gap(required:Measure|null,available:Measure|null){return result(compatible(required,available)?Math.max(0,required!.value-available!.value):null,required?.unit??'', [required,available],compatible(required,available)?[]:['required_and_available_same_scope_unit_period']);}
export function gapPercent(required:Measure|null,available:Measure|null){const g=gap(required,available);return {...g,value:g.value!==null&&required!.value>0?100*g.value/required!.value:null,unit:'%',status:g.value!==null&&required!.value>0?'calculated':'insufficient_data'} as Result;}
export function utilityRecovery(affected:Measure|null,restored:Measure|null){const ok=compatible(affected,restored)&&affected!.value>0&&restored!.value<=affected!.value;return result(ok?100*restored!.value/affected!.value:null,'%',[affected,restored],ok?[]:['affected_and_restored_compatible_positive_denominator']);}
export function damage(count:Measure|null,cost:number|null,severity:number|null){const ok=valid(count)&&count!.unit==='asset'&&cost!==null&&Number.isFinite(cost)&&cost>=0&&severity!==null&&Number.isFinite(severity)&&severity>=0&&severity<=1;return result(ok?count!.value*cost!*severity!:null,'IDR',[count],ok?[]:['asset_count_replacement_cost_severity']);}
export function economicLoss(normal:Measure|null,actual:Measure|null,days:number|null){const ok=compatible(normal,actual)&&normal!.unit==='IDR/day'&&days!==null&&Number.isFinite(days)&&days>0;return result(ok?Math.max(0,normal!.value-actual!.value)*days!:null,'IDR',[normal,actual],ok?[]:['comparable_net_daily_flows_and_duration']);}
export function totalLoss(physical:Result,flow:Result){return {...result(physical.value!==null&&flow.value!==null?physical.value+flow.value:null,'IDR',[],physical.value!==null&&flow.value!==null?[]:['physical_damage_and_economic_loss']),inputFactIds:[...new Set([...physical.inputFactIds,...flow.inputFactIds])]};}
export function forecast(population:number|null,rate:number|null,days:number|null,backlog:number|null,stock:number|null,incoming:number|null){const values=[population,rate,days,backlog,stock,incoming];return values.every(v=>v!==null&&Number.isFinite(v)&&v>=0)&&days!>0?Math.max(0,population!*rate!*days!+backlog!-stock!-incoming!):null;}
export function priority(s:number|null,g:number|null,v:number|null,t:number|null,a:number|null){const values=[s,g,v,t,a];return values.every(n=>n!==null&&Number.isFinite(n)&&n>=0&&n<=1)?100*(.30*s!+.25*g!+.20*v!+.15*t!+.10*a!):null;}
export const NEED_LABELS:Record<string,string>={clean_water:'Air aman',food:'Makanan',shelter:'Tempat tinggal',sanitation:'Higiene & sanitasi',medicine:'Kesehatan',clothing:'Pakaian & selimut',boat:'Evakuasi & distribusi',sar:'Pencarian & penyelamatan',repair:'Material perbaikan',access:'Pemulihan akses',heavy:'Alat berat',mask:'Perlindungan pernapasan',livestock:'Kebutuhan ternak',kitchen:'Dapur umum & logistik'};
export const HAZARD_NEEDS:Record<string,string[]>={flood:['clean_water','food','shelter','sanitation','medicine','clothing','boat'],earthquake:['sar','medicine','shelter','clean_water','food','repair','access'],landslide:['sar','heavy','access','boat','medicine','shelter','food'],volcano:['boat','mask','shelter','clean_water','medicine','livestock'],tsunami:['sar','boat','medicine','clean_water','food','shelter','access'],fire:['boat','medicine','mask','kitchen','shelter']};

// ---------------------------------------------------------------------------
// Phase 2 — deterministic calculation contract (production envelope).
// Reuses Measure/Result conventions; adds the fields the task requires.
// ---------------------------------------------------------------------------

/** Calculation lifecycle status. `null` inputs are never coerced to zero. */
export type CalculationStatus='calculated'|'insufficient_data'|'invalid_input';

export type CalculationType=
  |'physical_damage'|'economic_loss'|'total_loss'
  |'funding_gap'|'funding_gap_percent'|'physical_gap_count'|'physical_gap_percent'
  |'utility_recovery'
  |'needs_demand'|'needs_forecast_gap'
  |'priority_score';

/** One traced input: value+unit plus evidence provenance. */
export interface InputRef {
  label:string;
  value:number|null;
  unit:string;
  /** Firestore/doc/claim/article ids or scenario ids. Empty = no evidence. */
  sourceRefs:string[];
  /** ISO observation timestamp of the source, or null when unknown. */
  observedAt:string|null;
}

/** Typed deterministic result. Pure data — no React/Firestore/AI imports. */
export interface CalculationResult {
  type:CalculationType;
  version:string;
  value:number|null;
  unit:string;
  status:CalculationStatus;
  inputs:InputRef[];
  assumptions:string[];
  exclusions:string[];
  calculatedAt:string;
  warnings:string[];
  errors:string[];
  trace:string;
}

export const CALCULATION_ENGINE_VERSION=METHOD_VERSION;
export const PRIORITY_VERSION='priority-mvp-v1.0';
/** Centrally-defined MVP heuristic weights. Must sum to 1 (tested). */
export const PRIORITY_WEIGHTS={S:0.30,G:0.25,V:0.20,T:0.15,A:0.10} as const;
export type FundingStage='pledged'|'allocated'|'disbursed'|'available';
export type DamageEvidenceTier='observed'|'official_assessment'|'modeled';
export type NeedEvidenceTier='confirmed'|'inferred'|'potential';

/** Expected numerator/denominator unit per utility service (never mixed). */
export const UTILITY_UNITS:Record<string,string>={water:'households',electricity:'customers',telecom:'customers',access:'km'};

function calcInput(label:string,value:number|null,unit:string,sourceRefs:string[]=[],
  observedAt:string|null=null):InputRef{return{label,value,unit,sourceRefs,observedAt};}

function makeResult(type:CalculationType,value:number|null,unit:string,inputs:InputRef[],
  opts:{assumptions?:string[];exclusions?:string[];warnings?:string[];errors?:string[];trace?:string}={}):CalculationResult{
  const errors=opts.errors??[];
  const hasMissing=inputs.some(i=>i.value===null||!Number.isFinite(i.value as number));
  const status:CalculationStatus=errors.length>0?'invalid_input':value===null||hasMissing&&value===null?'insufficient_data':value===null?'insufficient_data':'calculated';
  // invalid_input takes precedence; insufficient_data when value null without hard errors.
  const finalStatus:CalculationStatus=errors.length>0?'invalid_input':(value===null?'insufficient_data':status);
  return {type,version:type==='priority_score'?PRIORITY_VERSION:CALCULATION_ENGINE_VERSION,
    value,unit,status:finalStatus,inputs,assumptions:opts.assumptions??[],exclusions:opts.exclusions??[],
    calculatedAt:new Date().toISOString(),warnings:opts.warnings??[],errors,trace:opts.trace??''};
}

const isMissing=(v:number|null|undefined):v is null|undefined=>v===null||v===undefined||!Number.isFinite(v as number);
function negErr(label:string,v:number|null|undefined,errors:string[]):boolean{
  if(v!==null&&v!==undefined&&Number.isFinite(v)&&v<0){errors.push(`${label} must be >= 0 (got ${v})`);return true;}
  return false;
}
function scopeMismatch(a:{unit:string;area:string;period:string},b:{unit:string;area:string;period:string}):string|null{
  if(a.unit!==b.unit)return `unit mismatch (${a.unit} vs ${b.unit})`;
  if(a.area!==b.area)return `geographic-scope mismatch (${a.area} vs ${b.area})`;
  if(a.period!==b.period)return `period mismatch (${a.period} vs ${b.period})`;
  return null;
}

/** Safe IDR arithmetic: integer rounding, overflow guard. Returns null when unsafe. */
export function roundIdr(n:number):number|null{
  if(!Number.isFinite(n)||n<0)return null;
  const r=Math.round(n);
  return Number.isSafeInteger(r)?r:null;
}
export function roundPct(n:number):number|null{
  if(!Number.isFinite(n))return null;
  return Math.round(n*100)/100;
}

/** Duplicate-evidence guard: same fact counted twice. */
export function duplicateFactIds(ids:string[]):string[]{
  const seen=new Set<string>();const dup=new Set<string>();
  for(const id of ids){if(seen.has(id))dup.add(id);seen.add(id);}
  return [...dup];
}

// --- A. Disaster Loss Estimation -------------------------------------------

export interface PhysicalDamageInput {
  assetCount:number|null; replacementCostPerAsset:number|null; damageFraction:number|null;
  currency?:string; area?:string; period?:string;
  sourceRefs?:string[]; observedAt?:string|null;
  evidenceTier?:DamageEvidenceTier;
}

export function estimatePhysicalDamage(inp:PhysicalDamageInput):CalculationResult{
  const errors:string[]=[];const warnings:string[]=[];
  const {assetCount,replacementCostPerAsset,damageFraction}=inp;
  if(assetCount!==null&&assetCount!==undefined&&!Number.isInteger(assetCount)&&Number.isFinite(assetCount))warnings.push('asset count should be an integer; fractional value kept as-is');
  if(assetCount!==null&&!isMissing(assetCount)&&!Number.isFinite(assetCount))errors.push('asset count is malformed');
  negErr('asset count',assetCount,errors);
  negErr('replacement cost',replacementCostPerAsset,errors);
  if(damageFraction!==null&&damageFraction!==undefined){
    if(!Number.isFinite(damageFraction))errors.push('damage fraction is malformed');
    else if(damageFraction<0||damageFraction>1)errors.push(`damage fraction must be between 0 and 1 (got ${damageFraction})`);
  }
  const missing= isMissing(assetCount)||isMissing(replacementCostPerAsset)||isMissing(damageFraction);
  const currency=inp.currency??'IDR';
  let value:number|null=null;
  if(errors.length===0&&!missing){
    const raw=assetCount!*replacementCostPerAsset!*damageFraction!;
    const rounded=roundIdr(raw);
    if(rounded===null)errors.push('damage result is unsafe (overflow/negative)');
    else value=rounded;
  }
  const inputs=[calcInput('affected_asset_count',assetCount,'asset',inp.sourceRefs??[],inp.observedAt??null),
    calcInput('replacement_cost_per_asset',replacementCostPerAsset,currency,[],null),
    calcInput('damage_fraction',damageFraction,'fraction 0-1',[],null)];
  const tier=inp.evidenceTier??'modeled';
  return makeResult('physical_damage',value,currency,inputs,{
    assumptions:[`damage = affected_asset_count × replacement_cost_per_asset × damage_fraction`,
      `currency=${currency}; area=${inp.area??'unspecified'}; period=${inp.period??'unspecified'}`,
      `evidence tier: ${tier} (observed=direct count, official_assessment=assessor figure, modeled=assumption-driven)`],
    exclusions:['lost income excluded here (belongs to economic loss)','other economic components excluded to avoid double-counting'],
    warnings,errors,
    trace: value===null?'damage: insufficient/invalid inputs — no value asserted':
      `${assetCount} × ${replacementCostPerAsset} × ${damageFraction} = ${value} ${currency}`});
}

export interface EconomicLossInput {
  dailyEconomicLoss:number|null; durationDays:number|null;
  currency?:string; area?:string; period?:string;
  sourceRefs?:string[]; observedAt?:string|null;
}

export function estimateEconomicLoss(inp:EconomicLossInput):CalculationResult{
  const errors:string[]=[];
  negErr('daily economic loss',inp.dailyEconomicLoss,errors);
  negErr('duration days',inp.durationDays,errors);
  if(inp.durationDays!==null&&inp.durationDays!==undefined&&Number.isFinite(inp.durationDays)&&inp.durationDays<=0)
    errors.push(`duration must be > 0 days (got ${inp.durationDays})`);
  if(inp.dailyEconomicLoss!==null&&inp.dailyEconomicLoss!==undefined&&Number.isFinite(inp.dailyEconomicLoss)&&!Number.isInteger(inp.durationDays as number)&&inp.durationDays!==null){}
  const missing=isMissing(inp.dailyEconomicLoss)||isMissing(inp.durationDays);
  const currency=inp.currency??'IDR';
  let value:number|null=null;
  if(errors.length===0&&!missing){
    const rounded=roundIdr(inp.dailyEconomicLoss!*inp.durationDays!);
    if(rounded===null)errors.push('economic loss result is unsafe');
    else value=rounded;
  }
  return makeResult('economic_loss',value,currency,
    [calcInput('daily_economic_loss',inp.dailyEconomicLoss,`${currency}/day`,inp.sourceRefs??[],inp.observedAt??null),
     calcInput('duration_days',inp.durationDays,'days',[],null)],
    {assumptions:[`economic_loss = daily_economic_loss × duration_days`,`currency=${currency}; area=${inp.area??'unspecified'}; period=${inp.period??'unspecified'}; duration defines the loss window`],
     exclusions:['physical damage excluded here (belongs to damage estimate)'],
     errors,trace:value===null?'economic_loss: insufficient/invalid inputs':`${inp.dailyEconomicLoss}/day × ${inp.durationDays} days = ${value} ${currency}`});
}

/** Net-flow variant (normal − actual) × days — preserves legacy economicLoss semantics. */
export function estimateEconomicLossNetFlow(normal:Measure|null,actual:Measure|null,days:number|null,
  opts:{area?:string;period?:string}={}):CalculationResult{
  const errors:string[]=[];
  if(days!==null&&Number.isFinite(days as number)&&(days as number)<=0)errors.push(`duration must be > 0 days (got ${days})`);
  const compat=compatible(normal,actual);
  const scopeErr=normal&&actual?scopeMismatch(normal,actual):'missing flow inputs';
  if(!compat&&scopeErr)errors.push(scopeErr);
  if(normal&&normal.unit!=='IDR/day')errors.push(`net flows must use IDR/day (got ${normal.unit})`);
  if(isMissing(days)) {/* missing -> insufficient */}
  else negErr('duration days',days,errors);
  if(normal&&normal.value<0)errors.push('normal flow must be >= 0');
  if(actual&&actual.value<0)errors.push('actual flow must be >= 0');
  let value:number|null=null;
  if(errors.length===0&&compat&&!isMissing(days))value=roundIdr(Math.max(0,normal!.value-actual!.value)*days!);
  const inputs=[calcInput('normal_net_daily_flow',normal?.value??null,normal?.unit??'IDR/day',normal?.factIds??[],null),
    calcInput('actual_net_daily_flow',actual?.value??null,actual?.unit??'IDR/day',actual?.factIds??[],null),
    calcInput('duration_days',days,'days',[],null)];
  if(value===null&&errors.length===0)return makeResult('economic_loss',null,'IDR',inputs,
    {assumptions:['economic_loss = max(0, normal − actual) × days'],exclusions:['physical damage excluded'],warnings:[],errors,trace:'economic_loss (net-flow): insufficient inputs'});
  return makeResult('economic_loss',value,'IDR',inputs,
    {assumptions:['economic_loss = max(0, normal − actual) × days',`area=${opts.area??normal?.area??'unspecified'}; period=${opts.period??normal?.period??'unspecified'}`],
     exclusions:['physical damage excluded'],errors,
     trace:value===null?`economic_loss (net-flow): ${errors.join('; ')||'insufficient inputs'}`:`max(0, ${normal!.value} − ${actual!.value}) × ${days} = ${value} IDR`});
}

export function estimateTotalLoss(physical:CalculationResult,flow:CalculationResult,
  opts:{inputsOverlap?:boolean}={}):CalculationResult{
  const warnings=[...physical.warnings,...flow.warnings];
  const errors=[...physical.errors,...flow.errors];
  if(opts.inputsOverlap){warnings.push('physical and economic inputs may overlap — combined total withheld (double-counting risk)');}
  const allRefs=[...physical.inputs.flatMap(i=>i.sourceRefs),...flow.inputs.flatMap(i=>i.sourceRefs)];
  const dups=duplicateFactIds(allRefs.filter(Boolean));
  if(dups.length>0)warnings.push(`duplicate evidence refs detected: ${dups.join(', ')} — verify no double-count`);
  let value:number|null=null;
  if(errors.length===0&&!opts.inputsOverlap&&physical.value!==null&&flow.value!==null){
    const sum=physical.value+flow.value;
    value=Number.isSafeInteger(Math.round(sum))?Math.round(sum):null;
    if(value===null)errors.push('combined total is unsafe');
  }
  const finalErrors=errors.length>0?errors:(value===null&&!opts.inputsOverlap?[]:errors);
  // When overlap is flagged we deliberately withhold the total: insufficient_data + warning.
  return {type:'total_loss',version:CALCULATION_ENGINE_VERSION,value,unit:'IDR',
    status:finalErrors.length>0?'invalid_input':value===null?'insufficient_data':'calculated',
    inputs:[...physical.inputs,...flow.inputs],
    assumptions:['total_loss = damage + economic_loss (only when scopes reconcile and no overlap)'],
    exclusions:['withheld when physical/economic components overlap'],
    calculatedAt:new Date().toISOString(),warnings,
    errors:opts.inputsOverlap?[]:finalErrors,
    trace: value===null?(opts.inputsOverlap?'total withheld: overlapping inputs — resolve double-count before combining':'total_loss: insufficient inputs — both damage and economic loss required'):`${physical.value} + ${flow.value} = ${value} IDR`};
}

// --- B. Recovery Gap Estimation --------------------------------------------

export interface FundingGapInput {
  requirement:number|null; available:number|null; currency?:string;
  area?:string; period?:string; programScope?:string;
  requirementStage?:FundingStage; availableStage?:FundingStage;
  sourceRefs?:string[]; observedAt?:string|null;
}

function fundingScopeCheck(inp:FundingGapInput):{errors:string[];warnings:string[]}{
  const errors:string[]=[];const warnings:string[]=[];
  if(inp.requirementStage&&inp.availableStage&&inp.requirementStage!==inp.availableStage)
    warnings.push(`funding stages differ (${inp.requirementStage} vs ${inp.availableStage}) — pledged/allocated/disbursed/available are not interchangeable; comparison withheld unless both are 'available'`);
  if(inp.availableStage&&inp.availableStage!=='available')
    warnings.push(`available funding stage is '${inp.availableStage}', not 'available' — treat as ${inp.availableStage}, not cash-in-hand`);
  return {errors,warnings};
}

export function estimateFundingGap(inp:FundingGapInput):CalculationResult{
  const errors:string[]=[];const warnings:string[]=[];
  negErr('recovery requirement',inp.requirement,errors);
  negErr('available funding',inp.available,errors);
  const sc=fundingScopeCheck(inp);warnings.push(...sc.warnings);errors.push(...sc.errors);
  const stageBlocked=(inp.requirementStage&&inp.availableStage&&inp.requirementStage!==inp.availableStage);
  const missing=isMissing(inp.requirement)||isMissing(inp.available);
  const currency=inp.currency??'IDR';
  let value:number|null=null;
  if(errors.length===0&&!missing&&!stageBlocked)value=roundIdr(Math.max(0,inp.requirement!-inp.available!));
  if(stageBlocked)value=null;
  return makeResult('funding_gap',value,currency,
    [calcInput('recovery_requirement',inp.requirement,currency,inp.sourceRefs??[],inp.observedAt??null),
     calcInput('available_funding',inp.available,currency,[],null)],
    {assumptions:[`funding_gap = max(0, requirement − available)`,`currency=${currency}; area=${inp.area??'unspecified'}; period=${inp.period??'unspecified'}; program=${inp.programScope??'unspecified'}`,
        `stages: requirement=${inp.requirementStage??'unspecified'}, available=${inp.availableStage??'unspecified'}`],
     exclusions:['physical gap kept separate — never averaged with financial gap'],
     warnings,errors,
     trace: value===null?`funding_gap: ${stageBlocked?'withheld (stage mismatch)':errors.length?'invalid inputs':'insufficient inputs'}`:`max(0, ${inp.requirement} − ${inp.available}) = ${value} ${currency}`});
}

export function estimateFundingGapPercent(inp:FundingGapInput):CalculationResult{
  const base=estimateFundingGap(inp);
  if(base.status!=='calculated'||(inp.requirement??0)<=0){
    const zeroDenom=inp.requirement!==null&&Number.isFinite(inp.requirement)&&inp.requirement<=0;
    return {...makeResult('funding_gap_percent',null,'%',
      [calcInput('recovery_requirement',inp.requirement,inp.currency??'IDR',inp.sourceRefs??[],inp.observedAt??null),
       calcInput('available_funding',inp.available,inp.currency??'IDR',[],null)],
      {assumptions:['funding_gap_percent = funding_gap / requirement × 100'],
       warnings:zeroDenom?[...base.warnings,'denominator requirement must be > 0 — percentage withheld (no division by zero)']:base.warnings,
       errors:base.errors,
       trace:'funding_gap_percent: denominator zero/missing — no division by zero'}),
      warnings:base.warnings};
  }
  const pct=roundPct(100*base.value!/inp.requirement!);
  return {...makeResult('funding_gap_percent',pct,'%',
    [calcInput('recovery_requirement',inp.requirement,inp.currency??'IDR',inp.sourceRefs??[],inp.observedAt??null),
     calcInput('available_funding',inp.available,inp.currency??'IDR',[],null)],
    {assumptions:['funding_gap_percent = funding_gap / requirement × 100'],warnings:base.warnings,errors:[],
     trace:`${base.value} / ${inp.requirement} × 100 = ${pct}%`}),warnings:base.warnings};
}

export interface PhysicalGapInput {
  affectedUnits:number|null; recoveredUnits:number|null; unit?:string;
  area?:string; period?:string; sourceRefs?:string[]; observedAt?:string|null;
}

export function estimatePhysicalGapCount(inp:PhysicalGapInput):CalculationResult{
  const errors:string[]=[];const warnings:string[]=[];
  negErr('affected units',inp.affectedUnits,errors);
  negErr('recovered units',inp.recoveredUnits,errors);
  if(!isMissing(inp.affectedUnits)&&!isMissing(inp.recoveredUnits)&&inp.recoveredUnits! > inp.affectedUnits!)
    errors.push(`recovered (${inp.recoveredUnits}) exceeds affected (${inp.affectedUnits}) — flagging inconsistent cohort instead of correcting`);
  const missing=isMissing(inp.affectedUnits)||isMissing(inp.recoveredUnits);
  const unit=inp.unit??'units';
  let value:number|null=null;
  if(errors.length===0&&!missing)value=inp.affectedUnits!-inp.recoveredUnits!;
  return makeResult('physical_gap_count',value,unit,
    [calcInput('affected_units',inp.affectedUnits,unit,inp.sourceRefs??[],inp.observedAt??null),
     calcInput('recovered_units',inp.recoveredUnits,unit,[],null)],
    {assumptions:[`physical_gap_count = affected − recovered`,`cohort: ${inp.area??'unspecified'} / ${inp.period??'unspecified'}; requires 0 ≤ recovered ≤ affected`],
     exclusions:['financial gap kept separate'],warnings,errors,
     trace:value===null?`physical_gap: ${errors.join('; ')||'insufficient inputs'}`:`${inp.affectedUnits} − ${inp.recoveredUnits} = ${value} ${unit} unrecovered`});
}

export function estimatePhysicalGapPercent(inp:PhysicalGapInput):CalculationResult{
  const count=estimatePhysicalGapCount(inp);
  const unit=inp.unit??'units';
  if(count.status!=='calculated'||(inp.affectedUnits??0)<=0){
    const zeroDenom=inp.affectedUnits!==null&&Number.isFinite(inp.affectedUnits)&&inp.affectedUnits<=0;
    return makeResult('physical_gap_percent',null,'%',
      [calcInput('affected_units',inp.affectedUnits,unit,inp.sourceRefs??[],inp.observedAt??null),
       calcInput('recovered_units',inp.recoveredUnits,unit,[],null)],
      {assumptions:['physical_gap_percent = gap_count / affected × 100'],
       errors:count.errors,
       warnings:zeroDenom?[...count.warnings,'affected denominator must be > 0 — percentage withheld (no division by zero)']:count.warnings,
       trace:'physical_gap_percent: denominator zero/missing — no division by zero'});
  }
  const pct=roundPct(100*count.value!/inp.affectedUnits!);
  return makeResult('physical_gap_percent',pct,'%',
    [calcInput('affected_units',inp.affectedUnits,unit,inp.sourceRefs??[],inp.observedAt??null),
     calcInput('recovered_units',inp.recoveredUnits,unit,[],null)],
    {assumptions:['physical_gap_percent = gap_count / affected × 100'],warnings:count.warnings,errors:[],
     trace:`${count.value} / ${inp.affectedUnits} × 100 = ${pct}%`});
}

// --- C. Utility Recovery Percentage -----------------------------------------

export interface UtilityRecoveryInput {
  service:'water'|'electricity'|'access'|'telecom';
  affected:number|null; recovered:number|null;
  area?:string; period?:string; sourceRefs?:string[]; observedAt?:string|null;
  /** When true, source explicitly marks restoration as temporary. */
  temporaryRestoration?:boolean|null;
  /** Definition of "operational" used by the source (required for calculated). */
  operationalDefinition?:string|null;
}

export function estimateUtilityRecovery(inp:UtilityRecoveryInput):CalculationResult{
  const errors:string[]=[];const warnings:string[]=[];
  const expectedUnit=UTILITY_UNITS[inp.service]??'units';
  negErr('affected units',inp.affected,errors);
  negErr('recovered units',inp.recovered,errors);
  if(!isMissing(inp.affected)&&!isMissing(inp.recovered)&&inp.recovered! > inp.affected!)
    errors.push(`recovered (${inp.recovered}) exceeds affected (${inp.affected}) — inconsistent sample`);
  if(inp.affected!==null&&Number.isFinite(inp.affected)&&inp.affected<=0)
    errors.push('affected denominator must be > 0 (zero/partial sample cannot yield a regional rate)');
  if(!inp.operationalDefinition)warnings.push('no operational-recovery definition supplied — rate assumes source-defined "recovered"');
  if(inp.temporaryRestoration===true)warnings.push('source marks restoration as temporary — distinguish from durable recovery');
  if(inp.temporaryRestoration===null||inp.temporaryRestoration===undefined)
    warnings.push('durability unknown (temporary vs durable not stated by source)');
  const missing=isMissing(inp.affected)||isMissing(inp.recovered);
  let value:number|null=null;
  if(errors.length===0&&!missing)value=roundPct(100*inp.recovered!/inp.affected!);
  return makeResult('utility_recovery',value,'%',
    [calcInput(`affected_${inp.service}`,inp.affected,expectedUnit,inp.sourceRefs??[],inp.observedAt??null),
     calcInput(`recovered_${inp.service}`,inp.recovered,expectedUnit,[],null)],
    {assumptions:[`recovery_percent = recovered / affected × 100`,`service=${inp.service}; unit=${expectedUnit} (never mixed across services)`,
        `cohort/boundary/period: ${inp.area??'unspecified'} / ${inp.period??'unspecified'}`,
        `operational = ${inp.operationalDefinition??'source-defined (unstated)'}`],
     exclusions:['other services excluded (no cross-service numerator/denominator)','partial/inconsistent samples excluded from regional claims'],
     warnings,errors,
     trace:value===null?`utility_recovery(${inp.service}): ${errors.join('; ')||'insufficient inputs'}`:`${inp.recovered}/${inp.affected} × 100 = ${value}% (${inp.service})`});
}

// --- D. Disaster Needs Intelligence ------------------------------------------

export interface NeedsDemandInput {
  targetPopulation:number|null; dailyRequirementPerPerson:number|null; durationDays:number|null;
  commodity?:string; unit?:string; area?:string; period?:string;
  sourceRefs?:string[]; observedAt?:string|null;
}

export function estimateNeedsDemand(inp:NeedsDemandInput):CalculationResult{
  const errors:string[]=[];
  negErr('target population',inp.targetPopulation,errors);
  negErr('daily requirement',inp.dailyRequirementPerPerson,errors);
  negErr('duration days',inp.durationDays,errors);
  if(inp.durationDays!==null&&Number.isFinite(inp.durationDays as number)&&(inp.durationDays as number)<=0)
    errors.push(`duration must be > 0 days (got ${inp.durationDays})`);
  const missing=isMissing(inp.targetPopulation)||isMissing(inp.dailyRequirementPerPerson)||isMissing(inp.durationDays);
  const unit=inp.unit??'units';
  let value:number|null=null;
  if(errors.length===0&&!missing){
    const raw=inp.targetPopulation!*inp.dailyRequirementPerPerson!*inp.durationDays!;
    value=Number.isFinite(raw)&&raw>=0?Math.round(raw*100)/100:null;
    if(value===null)errors.push('demand result is unsafe');
  }
  return makeResult('needs_demand',value,unit,
    [calcInput('target_population',inp.targetPopulation,'people',inp.sourceRefs??[],inp.observedAt??null),
     calcInput('daily_requirement_per_person',inp.dailyRequirementPerPerson,`${unit}/person/day`,[],null),
     calcInput('duration_days',inp.durationDays,'days',[],null)],
    {assumptions:[`demand = population × daily_rate × days`,`commodity=${inp.commodity??'unspecified'}; unit=${unit}; area=${inp.area??'unspecified'}; period=${inp.period??'unspecified'}`,
        'constant population over horizon; single commodity+unit'],
     exclusions:['backlog handled in forecast gap, not here'],
     errors,trace:value===null?`demand: ${errors.join('; ')||'insufficient inputs — target population/commodity/unit/duration/source required'}`:`${inp.targetPopulation} × ${inp.dailyRequirementPerPerson} × ${inp.durationDays} = ${value} ${unit}`});
}

export interface ForecastGapInput {
  demand:number|null; additionalBacklog:number|null;
  usableStock:number|null; expectedIncoming:number|null;
  unit?:string; area?:string; period?:string;
  sourceRefs?:string[]; observedAt?:string|null;
  /** True when the backlog window overlaps the demand window (double-count). */
  backlogOverlapsDemand?:boolean;
  /** Distribution history for this commodity/period (never counted as stock). */
  distributedHistory?:number|null;
}

export function estimateForecastGap(inp:ForecastGapInput):CalculationResult{
  const errors:string[]=[];const warnings:string[]=[];
  negErr('demand',inp.demand,errors);
  negErr('backlog',inp.additionalBacklog,errors);
  negErr('usable stock',inp.usableStock,errors);
  negErr('incoming supply',inp.expectedIncoming,errors);
  if(inp.backlogOverlapsDemand===true)errors.push('backlog overlaps the demand window — same demand would be counted twice; reconcile windows first');
  if(inp.distributedHistory!==null&&inp.distributedHistory!==undefined&&Number.isFinite(inp.distributedHistory)&&inp.distributedHistory>0)
    warnings.push(`distribution history (${inp.distributedHistory}) is reported movement, not available stock — excluded from usable stock`);
  const missing=isMissing(inp.demand)||isMissing(inp.additionalBacklog)||isMissing(inp.usableStock)||isMissing(inp.expectedIncoming);
  if(missing&&errors.length===0){
    // Per spec: incomplete inputs -> insufficient_data, never assume zero.
    return makeResult('needs_forecast_gap',null,inp.unit??'units',
      [calcInput('demand',inp.demand,inp.unit??'units',inp.sourceRefs??[],inp.observedAt??null),
       calcInput('additional_backlog',inp.additionalBacklog,inp.unit??'units',[],null),
       calcInput('usable_stock',inp.usableStock,inp.unit??'units',[],null),
       calcInput('expected_incoming',inp.expectedIncoming,inp.unit??'units',[],null)],
      {assumptions:['forecast_gap = max(0, demand + backlog − usable_stock − incoming)','only usable/unexpired/accessible stock; only scoped incoming supply'],
       exclusions:['distribution history excluded from stock','requested/committed/received/distributed stages never conflated with remaining stock'],
       warnings,errors,
       trace:'forecast_gap: insufficient inputs — explicit backlog/stock/incoming required (no silent zero)'});
  }
  let value:number|null=null;
  if(errors.length===0)value=Math.max(0,inp.demand!+inp.additionalBacklog!-inp.usableStock!-inp.expectedIncoming!);
  return makeResult('needs_forecast_gap',value,inp.unit??'units',
    [calcInput('demand',inp.demand,inp.unit??'units',inp.sourceRefs??[],inp.observedAt??null),
     calcInput('additional_backlog',inp.additionalBacklog,inp.unit??'units',[],null),
     calcInput('usable_stock',inp.usableStock,inp.unit??'units',[],null),
     calcInput('expected_incoming',inp.expectedIncoming,inp.unit??'units',[],null)],
    {assumptions:['forecast_gap = max(0, demand + backlog − usable_stock − incoming)','backlog = unmet demand OUTSIDE the current demand window'],
     exclusions:['distribution history excluded from stock'],
     warnings,errors,
     trace:value===null?`forecast_gap: ${errors.join('; ')}`:`max(0, ${inp.demand} + ${inp.additionalBacklog} − ${inp.usableStock} − ${inp.expectedIncoming}) = ${value} ${inp.unit??'units'}`});
}

export interface PriorityComponents { S:number|null; G:number|null; V:number|null; T:number|null; A:number|null; }

/** Documented 0–1 scales for each priority component (MVP heuristic, not a standard). */
export const PRIORITY_SCALES:Record<keyof PriorityComponents,string>={
  S:'severity: 0=no impact … 1=catastrophic (source-assessed)',
  G:'need-gap ratio: 0=all needs met … 1=nothing met',
  V:'vulnerability: 0=low … 1=extreme (children/elderly/disability/displacement)',
  T:'time urgency: 0=no rush … 1=hours matter (life-safety window closing)',
  A:'access constraint: 0=open … 1=cut off (no road/comms/access)',
};

export function priorityWeightsSum():number{
  return PRIORITY_WEIGHTS.S+PRIORITY_WEIGHTS.G+PRIORITY_WEIGHTS.V+PRIORITY_WEIGHTS.T+PRIORITY_WEIGHTS.A;
}

export function scorePriority(c:PriorityComponents):CalculationResult{
  const errors:string[]=[];const warnings:string[]=[
    'MVP heuristic only — not an official humanitarian standard. Show components, not just the rank.'];
  const missing:(keyof PriorityComponents)[]=[];
  (Object.keys(c) as Array<keyof PriorityComponents>).forEach(k=>{
    const v=c[k];
    if(v===null||v===undefined||!Number.isFinite(v)){missing.push(k);}
    else if(v<0||v>1)errors.push(`${k} must be within 0–1 (got ${v})`);
  });
  if(missing.length>0&&errors.length===0){
    return makeResult('priority_score',null,'/100',
      [calcInput('S_severity',c.S,'0-1',[],null),calcInput('G_gap',c.G,'0-1',[],null),
       calcInput('V_vulnerability',c.V,'0-1',[],null),calcInput('T_time_urgency',c.T,'0-1',[],null),
       calcInput('A_access',c.A,'0-1',[],null)],
      {assumptions:[`score = 100 × (0.30·S + 0.25·G + 0.20·V + 0.15·T + 0.10·A)`,`version=${PRIORITY_VERSION}`,
          ...Object.entries(PRIORITY_SCALES).map(([k,v])=>`${k}: ${v}`)],
       exclusions:['missing components withheld, never zero-filled'],
       warnings:[...warnings,`missing components (${missing.join(', ')}) — score withheld (never zero-filled)`],
       errors:[],
       trace:`priority: insufficient inputs — missing ${missing.join(', ')}`});
  }
  const sum=priorityWeightsSum();
  if(Math.abs(sum-1)>1e-9)errors.push(`weights must sum to 1 (got ${sum})`);
  let value:number|null=null;
  if(errors.filter(e=>!e.startsWith('MVP')).length===0){
    value=roundPct(100*(PRIORITY_WEIGHTS.S*c.S!+PRIORITY_WEIGHTS.G*c.G!+PRIORITY_WEIGHTS.V*c.V!+PRIORITY_WEIGHTS.T*c.T!+PRIORITY_WEIGHTS.A*c.A!));
  } else if(errors.length===1&&errors[0]!.startsWith('MVP')){
    value=null;
  }
  const hardErrors=errors.filter(e=>!e.startsWith('MVP'));
  return makeResult('priority_score',hardErrors.length===0?value:null,'/100',
    [calcInput('S_severity',c.S,'0-1',[],null),calcInput('G_gap',c.G,'0-1',[],null),
     calcInput('V_vulnerability',c.V,'0-1',[],null),calcInput('T_time_urgency',c.T,'0-1',[],null),
     calcInput('A_access',c.A,'0-1',[],null)],
    {assumptions:[`score = 100 × (0.30·S + 0.25·G + 0.20·V + 0.15·T + 0.10·A)`,`version=${PRIORITY_VERSION}; weights sum=${sum}`,
        ...Object.entries(PRIORITY_SCALES).map(([k,v])=>`${k}: ${v}`)],
     exclusions:['missing components withheld, never zero-filled'],
     warnings,errors:hardErrors,
     trace:hardErrors.length>0?`priority: ${hardErrors.join('; ')}`:`100 × (0.30×${c.S} + 0.25×${c.G} + 0.20×${c.V} + 0.15×${c.T} + 0.10×${c.A}) = ${value}/100`});
}

export interface LifeSafetyInput { severity:number|null; timeUrgency:number|null; lifeThreat:boolean|null; }
/**
 * Configurable critical-life-safety override (MVP).
 * Triggers URGENT_ASSESSMENT_REQUIRED — never prescribes field actions.
 * Criteria: explicit lifeThreat=true AND (S ≥ 0.8 OR T = 1). Otherwise no override.
 */
export function evaluateLifeSafetyOverride(inp:LifeSafetyInput):{triggered:boolean;reason:string}{
  if(inp.lifeThreat===true&&((inp.severity!==null&&inp.severity>=0.8)||inp.timeUrgency===1))
    return {triggered:true,reason:'life-safety override: explicit life threat with S≥0.8 or T=1 → URGENT_ASSESSMENT_REQUIRED (assessment only, no automatic field action)'};
  return {triggered:false,reason:'no override: requires explicit lifeThreat=true plus S≥0.8 or T=1'};
}

/** Confirmed vs inferred vs potential — reuses humanitarian NeedStatus conventions. */
export function classifyNeedTier(status:import('../../domain/humanitarian').NeedStatus|null|undefined,
  verification:import('../../domain/intelligence').VerificationStatus|null|undefined):NeedEvidenceTier{
  if(status==='VERIFIED'||verification==='VERIFIED')return 'confirmed';
  if(status==='REPORTED'||status==='INFERRED'||status==='PENDING_VALIDATION'||status==='PARTIALLY_FULFILLED'
    ||verification==='AI_REVIEWED'||verification==='CONFLICTING')return 'inferred';
  return 'potential';
}
