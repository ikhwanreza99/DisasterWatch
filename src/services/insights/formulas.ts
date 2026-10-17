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
/**
 * Presentation status vocabulary (audit/PDF §8, §10). The engine `status`
 * trio is stable and asserted by tests; this extended label is DERIVED via
 * resolveExtendedStatus() and never stored as a second competing truth.
 * - scenario_estimate: calculated from explicitly simulated inputs
 * - forecast: a forward-looking projection (forecast-gap family)
 * - conflict_pending_review: withheld because sources conflict
 * - stale_data: a calculated value older than the caller's freshness bound
 */
export type ExtendedResultStatus='calculated'|'scenario_estimate'|'forecast'|'insufficient_data'|'invalid_input'|'conflict_pending_review'|'stale_data';

export type CalculationType=
  |'physical_damage'|'economic_loss'|'total_loss'
  |'funding_gap'|'funding_gap_percent'|'physical_gap_count'|'physical_gap_percent'
  |'utility_recovery'|'utility_ori_index'
  |'needs_demand'|'needs_current_gap'|'needs_forecast_gap'
  |'physical_damage_aggregate'|'fact_reconciled_total'
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

/** Where the inputs came from. Explicit — never inferred from values. */
export type CalculationOrigin='simulation'|'live'|'unknown';
/** Geographic + reporting scope carried by a result for comparability checks. */
export interface CalculationScope { area:string|null; period:string|null; }
/** Shared caller-supplied provenance. All optional so legacy calls keep working. */
export interface BaseCalculationInput {
  sourceRefs?:string[];
  observedAt?:string|null;
  /** Correlation ID for tracing a run across logs/UI. Default null. */
  calculationId?:string|null;
  /** Explicit simulation-vs-live designation. Default 'unknown'. */
  origin?:'simulation'|'live';
}

/** Typed deterministic result. Pure data — no React/Firestore/AI imports. */
export interface CalculationResult {
  type:CalculationType;
  /** Stable metric identifier, e.g. 'physical_damage', 'ori_index'. Set by the
      calculation service; null when the engine was invoked directly. */
  metricId:string|null;
  /** Incident this result belongs to. Null for incident-agnostic scenarios. */
  incidentId:string|null;
  /** Caller-supplied correlation ID (null when the caller did not set one). */
  id:string|null;
  /** Explicit simulation-vs-live designation. */
  origin:CalculationOrigin;
  /** Geographic + reporting scope when the inputs declared one. */
  scope:CalculationScope;
  /** Baseline / parameter registry references (PDF §10 baseline_ids). Empty
      until baseline registries exist; never invented. */
  baselineIds:string[];
  /** Labels of required inputs that arrived null/missing. Never zero-filled. */
  missingInputs:string[];
  /** Uncertainty note (method bounds, MVP-heuristic caveats). Null when none. */
  uncertainty:string|null;
  /** Human-readable coverage (cohort/boundary), e.g. 'SBD / 2026-10-04'. */
  coverage:string|null;
  /** Valid time of the underlying observation (ISO), if declared. */
  validTime:string|null;
  /** Deduplicated source fact/doc ids backing this result. */
  sourceFactIds:string[];
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
  opts:{assumptions?:string[];exclusions?:string[];warnings?:string[];errors?:string[];trace?:string;id?:string|null;origin?:CalculationOrigin;scope?:CalculationScope;metricId?:string|null;incidentId?:string|null;baselineIds?:string[];uncertainty?:string|null;coverage?:string|null;validTime?:string|null}={}):CalculationResult{
  const errors=opts.errors??[];
  const hasMissing=inputs.some(i=>i.value===null||!Number.isFinite(i.value as number));
  const status:CalculationStatus=errors.length>0?'invalid_input':value===null||hasMissing&&value===null?'insufficient_data':value===null?'insufficient_data':'calculated';
  // invalid_input takes precedence; insufficient_data when value null without hard errors.
  const finalStatus:CalculationStatus=errors.length>0?'invalid_input':(value===null?'insufficient_data':status);
  // Central duplicate-evidence guard: the same source ref feeding two inputs of
  // one calculation is a double-count risk. Warning only — status unchanged.
  const warnings=[...(opts.warnings??[])];
  const dupRefs=duplicateFactIds(inputs.flatMap(i=>i.sourceRefs).filter(Boolean));
  if(dupRefs.length>0)warnings.push(`duplicate source refs in one calculation: ${dupRefs.join(', ')} — verify the same evidence is not counted twice`);
  const scope=opts.scope??{area:null,period:null};
  const refs=[...new Set(inputs.flatMap(i=>i.sourceRefs).filter(Boolean))];
  return {type,metricId:opts.metricId??type,incidentId:opts.incidentId??null,
    id:opts.id??null,origin:opts.origin??'unknown',scope,
    baselineIds:opts.baselineIds??[],
    missingInputs:inputs.filter(i=>i.value===null||!Number.isFinite(i.value as number)).map(i=>i.label),
    uncertainty:opts.uncertainty??null,
    coverage:opts.coverage??(scope.area||scope.period?`${scope.area??'?'} / ${scope.period??'?'}`:null),
    validTime:opts.validTime??null,
    sourceFactIds:refs,
    version:type==='priority_score'?PRIORITY_VERSION:CALCULATION_ENGINE_VERSION,
    value,unit,status:finalStatus,inputs,assumptions:opts.assumptions??[],exclusions:opts.exclusions??[],
    calculatedAt:new Date().toISOString(),warnings,errors,trace:opts.trace??''};
}
/**
 * Derive the 7-label presentation status from an engine result WITHOUT
 * changing engine behavior. Deterministic; pure.
 * - errors → invalid_input; conflict markers while withheld → conflict_pending_review
 * - null value → insufficient_data
 * - older than maxAgeMs (when given) → stale_data
 * - forecast family or mode 'forecast' → forecast
 * - simulation origin or mode 'scenario' → scenario_estimate
 * - otherwise calculated
 */
export function resolveExtendedStatus(result:CalculationResult,
  opts:{mode?:'current'|'scenario'|'forecast';maxAgeMs?:number|null;nowMs?:number}={}):ExtendedResultStatus{
  if(result.errors.length>0)return 'invalid_input';
  if(result.value===null){
    const text=`${result.errors.join(' ')} ${result.trace} ${result.warnings.join(' ')}`;
    if(/conflict/i.test(text))return 'conflict_pending_review';
    return 'insufficient_data';
  }
  if(opts.maxAgeMs!==null&&opts.maxAgeMs!==undefined){
    const t=Date.parse(result.calculatedAt);
    const now=opts.nowMs??Date.now();
    if(Number.isFinite(t)&&now-t>opts.maxAgeMs)return 'stale_data';
  }
  if(opts.mode==='forecast'||result.type==='needs_forecast_gap')return 'forecast';
  if(opts.mode==='scenario'||result.origin==='simulation')return 'scenario_estimate';
  return 'calculated';
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

export interface PhysicalDamageInput extends BaseCalculationInput {
  assetCount:number|null; replacementCostPerAsset:number|null; damageFraction:number|null;
  /** Unit of damageFraction. 'percent' converts explicitly (50 → 0.5); a bare
      value > 1 with 'fraction' is invalid, never silently rescaled. */
  damageFractionUnit?:'fraction'|'percent';
  currency?:string; area?:string; period?:string;
  evidenceTier?:DamageEvidenceTier;
}
/** Explicit severity conversion. Percent and fraction are never interchanged
    silently: 50 with 'fraction' is an error, 50 with 'percent' is 0.5. */
export function toDamageFraction(value:number|null,unit:'fraction'|'percent'):{fraction:number|null;error:string|null}{
  if(value===null||value===undefined||!Number.isFinite(value))return{fraction:null,error:null};
  if(unit==='percent'){
    if(value<0||value>100)return{fraction:null,error:`damage percent must be between 0 and 100 (got ${value})`};
    return{fraction:value/100,error:null};
  }
  if(value<0||value>1)return{fraction:null,error:`damage fraction must be between 0 and 1 (got ${value}); pass unit 'percent' for percentage inputs`};
  return{fraction:value,error:null};
}

export function estimatePhysicalDamage(inp:PhysicalDamageInput):CalculationResult{
  const errors:string[]=[];const warnings:string[]=[];
  const {assetCount,replacementCostPerAsset,damageFraction}=inp;
  const fracUnit=inp.damageFractionUnit??'fraction';
  if(assetCount!==null&&assetCount!==undefined&&!Number.isInteger(assetCount)&&Number.isFinite(assetCount))warnings.push('asset count should be an integer; fractional value kept as-is');
  if(assetCount!==null&&!isMissing(assetCount)&&!Number.isFinite(assetCount))errors.push('asset count is malformed');
  negErr('asset count',assetCount,errors);
  negErr('replacement cost',replacementCostPerAsset,errors);
  // Explicit severity conversion: percent inputs declare their unit up front.
  const conv=toDamageFraction(damageFraction,fracUnit);
  if(conv.error)errors.push(conv.error);
  const fraction=conv.fraction;
  const missing= isMissing(assetCount)||isMissing(replacementCostPerAsset)||fraction===null;
  const currency=inp.currency??'IDR';
  let value:number|null=null;
  if(errors.length===0&&!missing){
    const raw=assetCount!*replacementCostPerAsset!*fraction!;
    const rounded=roundIdr(raw);
    if(rounded===null)errors.push('damage result is unsafe (overflow/negative)');
    else value=rounded;
  }
  const inputs=[calcInput('affected_asset_count',assetCount,'asset',inp.sourceRefs??[],inp.observedAt??null),
    calcInput('replacement_cost_per_asset',replacementCostPerAsset,currency,[],null),
    calcInput('damage_fraction',fraction,'fraction 0-1',[],null)];
  const tier=inp.evidenceTier??'modeled';
  const convNote=fracUnit==='percent'&&fraction!==null?`severity ${damageFraction}% → ${fraction} (explicit percent conversion)`:null;
  return makeResult('physical_damage',value,currency,inputs,{
    id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:inp.area??null,period:inp.period??null},
    assumptions:[`damage = affected_asset_count × replacement_cost_per_asset × damage_fraction`,
      `severity unit: ${fracUnit}${convNote?` (${convNote})`:''}`,
      `currency=${currency}; area=${inp.area??'unspecified'}; period=${inp.period??'unspecified'}`,
      `evidence tier: ${tier} (observed=direct count, official_assessment=assessor figure, modeled=assumption-driven)`],
    exclusions:['lost income excluded here (belongs to economic loss)','other economic components excluded to avoid double-counting'],
    warnings,errors,
    trace: value===null?'damage: insufficient/invalid inputs — no value asserted':
      `${assetCount} × ${replacementCostPerAsset} × ${fraction}${convNote?` [${convNote}]`:''} = ${value} ${currency}`});
}

export interface EconomicLossInput extends BaseCalculationInput {
  dailyEconomicLoss:number|null; durationDays:number|null;
  /** 'net' = loss after coping/adaptation (guideline default); 'gross' = total
      output lost. Recorded in assumptions/trace so the two are never confused. */
  basis?:'net'|'gross';
  currency?:string; area?:string; period?:string;
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
  const basis=inp.basis??'net';
  let value:number|null=null;
  if(errors.length===0&&!missing){
    const rounded=roundIdr(inp.dailyEconomicLoss!*inp.durationDays!);
    if(rounded===null)errors.push('economic loss result is unsafe');
    else value=rounded;
  }
  return makeResult('economic_loss',value,currency,
    [calcInput(basis==='gross'?'gross_daily_economic_loss':'net_daily_economic_loss',inp.dailyEconomicLoss,`${currency}/day`,inp.sourceRefs??[],inp.observedAt??null),
     calcInput('duration_days',inp.durationDays,'days',[],null)],
    {id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:inp.area??null,period:inp.period??null},
     assumptions:[`economic_loss (${basis}) = daily_${basis}_economic_loss × duration_days`,
      basis==='net'?'net = loss after coping/adaptation (guideline default)':'gross = total output lost (kept distinct from net)',
      `currency=${currency}; area=${inp.area??'unspecified'}; period=${inp.period??'unspecified'}; duration defines the loss window`],
     exclusions:['physical damage excluded here (belongs to damage estimate)'],
     errors,trace:value===null?'economic_loss: insufficient/invalid inputs':`${basis} ${inp.dailyEconomicLoss}/day × ${inp.durationDays} days = ${value} ${currency}`});
}

/** Net-flow variant (normal − actual) × days — preserves legacy economicLoss semantics. */
export function estimateEconomicLossNetFlow(normal:Measure|null,actual:Measure|null,days:number|null,
  opts:{area?:string;period?:string;calculationId?:string|null;origin?:'simulation'|'live'}={}):CalculationResult{
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
  const nfScope={area:opts.area??normal?.area??null,period:opts.period??normal?.period??null};
  if(value===null&&errors.length===0)return makeResult('economic_loss',null,'IDR',inputs,
    {id:opts.calculationId??null,origin:opts.origin??'unknown',scope:nfScope,assumptions:['economic_loss (net) = max(0, normal − actual) × days','net derivation from comparable daily flows; kept distinct from gross daily-loss variant'],exclusions:['physical damage excluded'],warnings:[],errors,trace:'economic_loss (net-flow): insufficient inputs'});
  return makeResult('economic_loss',value,'IDR',inputs,
    {id:opts.calculationId??null,origin:opts.origin??'unknown',scope:nfScope,
     assumptions:['economic_loss (net) = max(0, normal − actual) × days','net derivation from comparable daily flows; kept distinct from gross daily-loss variant',`area=${opts.area??normal?.area??'unspecified'}; period=${opts.period??normal?.period??'unspecified'}`],
     exclusions:['physical damage excluded'],errors,
     trace:value===null?`economic_loss (net-flow): ${errors.join('; ')||'insufficient inputs'}`:`net max(0, ${normal!.value} − ${actual!.value}) × ${days} = ${value} IDR`});
}

export function estimateTotalLoss(physical:CalculationResult,flow:CalculationResult,
  opts:{inputsOverlap?:boolean;calculationId?:string|null}={}):CalculationResult{
  const warnings=[...physical.warnings,...flow.warnings];
  const errors=[...physical.errors,...flow.errors];
  if(opts.inputsOverlap){warnings.push('physical and economic inputs may overlap — combined total withheld (double-counting risk)');}
  const allRefs=[...physical.inputs.flatMap(i=>i.sourceRefs),...flow.inputs.flatMap(i=>i.sourceRefs)];
  const dups=duplicateFactIds(allRefs.filter(Boolean));
  if(dups.length>0)warnings.push(`duplicate evidence refs detected: ${dups.join(', ')} — verify no double-count`);
  // Automatic scope guard: components with explicitly different areas/periods
  // are not comparable — withhold instead of asserting a combined total.
  // (Matches the guideline: total only when scopes reconcile.)
  const pScope=physical.scope, fScope=flow.scope;
  const scopeClash=(pScope.area&&fScope.area&&pScope.area!==fScope.area)||(pScope.period&&fScope.period&&pScope.period!==fScope.period);
  if(scopeClash)warnings.push(`component scopes differ (damage ${pScope.area??'?'} / ${pScope.period??'?'} vs economic ${fScope.area??'?'} / ${fScope.period??'?'} — combined total withheld until reconciled)`);
  const blocked=!!opts.inputsOverlap||!!scopeClash;
  const scope={area:pScope.area??fScope.area??null,period:pScope.period??fScope.period??null};
  let value:number|null=null;
  if(errors.length===0&&!blocked&&physical.value!==null&&flow.value!==null){
    const sum=physical.value+flow.value;
    value=Number.isSafeInteger(Math.round(sum))?Math.round(sum):null;
    if(value===null)errors.push('combined total is unsafe');
  }
  const finalErrors=errors.length>0?errors:(value===null&&!blocked?[]:errors);
  // Withheld totals stay insufficient_data (blocker in warnings), never errors.
  const origin:CalculationOrigin=physical.origin==='live'&&flow.origin==='live'?'live':physical.origin==='simulation'&&flow.origin==='simulation'?'simulation':'unknown';
  const combinedInputs=[...physical.inputs,...flow.inputs];
  const combinedRefs=[...new Set(combinedInputs.flatMap(i=>i.sourceRefs).filter(Boolean))];
  return {type:'total_loss',metricId:'total_loss',incidentId:physical.incidentId??flow.incidentId??null,
    id:opts.calculationId??null,origin,scope,baselineIds:[],
    missingInputs:combinedInputs.filter(i=>i.value===null||!Number.isFinite(i.value as number)).map(i=>i.label),
    uncertainty:null,coverage:scope.area||scope.period?`${scope.area??'?'} / ${scope.period??'?'}`:null,
    validTime:null,sourceFactIds:combinedRefs,
    version:CALCULATION_ENGINE_VERSION,value,unit:'IDR',
    status:finalErrors.length>0?'invalid_input':value===null?'insufficient_data':'calculated',
    inputs:combinedInputs,
    assumptions:['total_loss = damage + economic_loss (only when scopes reconcile and no overlap)'],
    exclusions:['withheld when physical/economic components overlap or scopes differ'],
    calculatedAt:new Date().toISOString(),warnings,
    errors:blocked?[]:finalErrors,
    trace: value===null?(blocked?'total withheld: overlapping inputs or mismatched scopes — resolve before combining':'total_loss: insufficient inputs — both damage and economic loss required'):`${physical.value} + ${flow.value} = ${value} IDR`};
}

// --- A2. Multi-category physical damage aggregation ----------------------------------
// Damage = SUM_i(AssetCount_i × ReplacementCost_i × SeverityFraction_i).
// Each category is validated independently (genuine asset counts, explicit
// severity unit, compatible cost/scope) and the combined total is withheld
// unless compatibility across categories can be established.

/** Demographic/population units that are NEVER valid asset counts. */
const NON_ASSET_UNITS=['household','households','kk','family','families','person','people','persons','jiwa','orang','individual','individuals','capita','householder','householders'];

export interface DamageCategoryInput {
  categoryId:string;
  assetCount:number|null;
  /** Observed count unit. Must be a genuine asset unit (never households/people). */
  assetUnit:string|null;
  replacementCostPerAsset:number|null;
  currency:string|null;
  damageFraction:number|null;
  damageFractionUnit?:'fraction'|'percent';
  area?:string|null; period?:string|null;
  /** Assessment scope (e.g. assessor + method + date). Must agree to combine. */
  assessmentScope?:string|null;
  sourceRefs?:string[];
  observedAt?:string|null;
}

export interface DamageAggregateInput extends BaseCalculationInput {
  categories:DamageCategoryInput[];
}

export function estimateDamageAggregate(inp:DamageAggregateInput):CalculationResult{
  const errors:string[]=[];const warnings:string[]=[];
  const cats=inp.categories??[];
  if(cats.length===0)errors.push('no asset categories supplied');
  const ids=cats.map(c=>c.categoryId);
  for(const dup of duplicateFactIds(ids.filter(Boolean)))
    errors.push(`duplicate asset category: '${dup}' supplied twice — categories must be disjoint`);
  interface Row { c:DamageCategoryInput; fraction:number|null; lineValue:number|null; }
  const rows:Row[]=cats.map(c=>({c,fraction:null,lineValue:null}));
  for(const row of rows){
    const c=row.c;
    if(!c.categoryId)errors.push('asset category without an id');
    const unit=(c.assetUnit??'').toLowerCase().trim();
    if(!unit)errors.push(`category '${c.categoryId||'?'}': count unit missing — genuine asset counts required, not households or people`);
    else if(NON_ASSET_UNITS.includes(unit))
      errors.push(`category '${c.categoryId}': unit '${c.assetUnit}' is a household/population count, not an asset count — never auto-converted`);
    negErr(`asset count (${c.categoryId})`,c.assetCount,errors);
    negErr(`replacement cost (${c.categoryId})`,c.replacementCostPerAsset,errors);
    if(c.assetCount!==null&&c.assetCount!==undefined&&!Number.isInteger(c.assetCount)&&Number.isFinite(c.assetCount))
      warnings.push(`category '${c.categoryId}': asset count should be an integer; fractional value kept as-is`);
    const conv=toDamageFraction(c.damageFraction,c.damageFractionUnit??'fraction');
    if(conv.error)errors.push(`category '${c.categoryId}': ${conv.error}`);
    row.fraction=conv.fraction;
    if(!isMissing(c.assetCount)&&!isMissing(c.replacementCostPerAsset)&&conv.fraction!==null){
      const line=roundIdr(c.assetCount!*c.replacementCostPerAsset!*conv.fraction!);
      if(line===null)errors.push(`category '${c.categoryId}': line result unsafe (overflow/negative)`);
      else row.lineValue=line;
    }
  }
  // Compatibility across categories: currency, geography, date, scope.
  const currs=[...new Set(cats.map(c=>c.currency).filter((x):x is string=>!!x))];
  const areas=[...new Set(cats.map(c=>c.area).filter((x):x is string=>!!x))];
  const periods=[...new Set(cats.map(c=>c.period).filter((x):x is string=>!!x))];
  const scopes=[...new Set(cats.map(c=>c.assessmentScope).filter((x):x is string=>!!x))];
  const compatClash=currs.length>1||areas.length>1||periods.length>1||scopes.length>1;
  const anyMissingLine=rows.some(r=>r.lineValue===null);
  const inputs=cats.flatMap(c=>[calcInput(`${c.categoryId}_count`,c.assetCount,c.assetUnit??'units',c.sourceRefs??[],c.observedAt??null),
    calcInput(`${c.categoryId}_cost`,c.replacementCostPerAsset,c.currency??'IDR',[],null),
    calcInput(`${c.categoryId}_severity`,rows.find(r=>r.c===c)!.fraction,'fraction 0-1',[],null)]);
  const perLine=rows.map(r=>`${r.c.categoryId}: ${r.c.assetCount} × ${r.c.replacementCostPerAsset} × ${r.fraction}${r.c.damageFractionUnit==='percent'?` [${r.c.damageFraction}% → ${r.fraction}]`:''} = ${r.lineValue===null?'withheld':r.lineValue}`).join(' | ');
  if(errors.length===0&&(anyMissingLine||compatClash)){
    const reasons:string[]=[];
    if(anyMissingLine)reasons.push('one or more categories lack a valid count, cost or severity (never zero-filled)');
    if(compatClash)reasons.push(`incompatible category scopes (currencies: ${currs.join(', ')||'—'}; areas: ${areas.join(', ')||'—'}; periods: ${periods.join(', ')||'—'}; scopes: ${scopes.join(', ')||'—'})`);
    return makeResult('physical_damage_aggregate',null,currs.length===1?currs[0]!:'IDR',inputs,
      {id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:areas.length===1?areas[0]!:null,period:periods.length===1?periods[0]!:null},
       assumptions:['damage = SUM_i(count_i × cost_i × severity_i)','categories must be disjoint with compatible cost unit, geography, date and assessment scope'],
       exclusions:['lost income and other economic components excluded'],
       warnings:[...warnings,`combined total withheld: ${reasons.join('; ')}`],errors:[],
       trace:`damage aggregate: withheld — ${reasons.join('; ')}. Lines: ${perLine}`});
  }
  let value:number|null=null;
  if(errors.length===0){
    const sum=rows.reduce((t,r)=>t+(r.lineValue??0),0);
    value=Number.isSafeInteger(Math.round(sum))?Math.round(sum):null;
    if(value===null)errors.push('aggregated damage is unsafe (overflow)');
  }
  return makeResult('physical_damage_aggregate',value,currs.length===1?currs[0]!:'IDR',inputs,
    {id:inp.calculationId??null,origin:inp.origin??'unknown',
     scope:{area:areas.length===1?areas[0]!:null,period:periods.length===1?periods[0]!:null},
     assumptions:['damage = SUM_i(count_i × cost_i × severity_i)','categories verified disjoint with compatible scopes'],
     exclusions:['lost income and other economic components excluded'],
     warnings,errors,
     trace:value===null?`damage aggregate: ${errors.join('; ')}`:`SUM = ${value} ${currs[0]??'IDR'} (${perLine})`});
}

// --- A3. Parent-child fact reconciliation ---------------------------------------------
// Aggregates facts that are totals, subsets, or disjoint groups into one
// canonical total — or withholds when relationships are unknown, conflicting,
// or overlapping. Every fact's inclusion/exclusion and reason is preserved in
// the trace. This is NOT allocateAggregate (which apportions a total downward).

export type FactRelation='total'|'subset'|'independent'|'revision'|'unknown';
export interface ReconcilableFact {
  factId:string;
  value:number|null;
  unit:string;
  area?:string|null; period?:string|null;
  relation:FactRelation;
  /** Parent total this subset belongs to (for relation 'subset'). */
  parentFactId?:string|null;
  /** Group key for disjoint-group sets and revision chains. */
  groupKey?:string|null;
  sourceRefs:string[];
  observedAt?:string|null;
}

export interface ReconcileFactsInput extends BaseCalculationInput {
  facts:ReconcilableFact[];
  /** Declared unit of the canonical total. Facts in other units are excluded. */
  unit?:string;
  /** Caller-confirmed disjointness for independent/subset groups without a
      parent total. Unknown relationships are never summed blindly. */
  disjointGroupsConfirmed?:boolean;
}

interface Lineage { factId:string; included:boolean; reason:string; }

export function reconcileFacts(inp:ReconcileFactsInput):CalculationResult{
  const errors:string[]=[];const warnings:string[]=[];
  // Scope-divergence note: summed facts spanning different areas/periods are
  // NOT blocked (the caller confirmed disjointness), but the divergence is
  // recorded so geography/valid-time is never silently double-counted.
  const scopeNote=(set:Array<{area?:string|null;period?:string|null}>)=>{
    const areas=[...new Set(set.map(f=>f.area).filter((a):a is string=>!!a))];
    const periods=[...new Set(set.map(f=>f.period).filter((x):x is string=>!!x))];
    if(areas.length>1||periods.length>1)
      warnings.push(`summed facts span differing scopes (areas: ${areas.join(', ')||'—'}; periods: ${periods.join(', ')||'—'}) — total relies on caller disjointness confirmation`);
  };
  const facts=inp.facts??[];
  const unit=inp.unit??'units';
  const lineage:Lineage[]=[];
  const usable=facts.filter(f=>{
    if(f.value===null||f.value===undefined||!Number.isFinite(f.value)||f.value<0){
      lineage.push({factId:f.factId,included:false,reason:'missing, non-finite or negative value — excluded, never zero-filled'});return false;}
    if(f.unit!==unit){
      lineage.push({factId:f.factId,included:false,reason:`incompatible unit '${f.unit}' vs '${unit}'`});return false;}
    if(f.relation==='unknown'){
      lineage.push({factId:f.factId,included:false,reason:'unknown relationship — never summed blindly'});return false;}
    return true;
  });
  // Duplicate source claims of the SAME value count once (syndication guard).
  const seenClaims=new Set<string>();
  const deduped:typeof usable=[];
  for(const f of usable){
    const key=[...f.sourceRefs].sort().join('+')+`=${f.value}`;
    if(seenClaims.has(key)){
      lineage.push({factId:f.factId,included:false,reason:'duplicated source claim of an identical value — counted once'});continue;}
    seenClaims.add(key);
    deduped.push(f);
  }
  // Revision chains: keep the latest observed entry per group; supersede rest.
  // A revision also supersedes same-group non-revision facts (e.g. the earlier
  // independent report it revises) — otherwise both would be counted.
  const latest=new Map<string,typeof deduped[number]>();
  const current:typeof deduped=[];
  for(const f of deduped){
    if(f.relation!=='revision'||!f.groupKey){current.push(f);continue;}
    const prev=latest.get(f.groupKey);
    const t=f.observedAt??'';
    if(!prev||t>=(prev.observedAt??'')){ if(prev)lineage.push({factId:prev.factId,included:false,reason:`superseded by revision ${f.factId}`}); latest.set(f.groupKey,f); }
    else lineage.push({factId:f.factId,included:false,reason:`superseded revision — ${prev.factId} is newer`});
  }
  current.push(...latest.values());
  const live:typeof current=[];
  for(const f of current){
    if(f.relation!=='revision'&&f.groupKey&&latest.has(f.groupKey)){
      lineage.push({factId:f.factId,included:false,reason:`superseded by revision chain in group '${f.groupKey}' — kept latest ${latest.get(f.groupKey)!.factId}`});continue;}
    live.push(f);
  }
  const totals=live.filter(f=>f.relation==='total');
  const distinctTotals=[...new Set(totals.map(f=>f.value))];
  if(totals.length>1&&distinctTotals.length>1){
    for(const f of totals)lineage.push({factId:f.factId,included:false,reason:'conflicting totals for the same scope — withheld pending reconciliation'});
    return makeResult('fact_reconciled_total',null,unit,
      facts.map(f=>calcInput(f.factId,f.value,unit,[f.factId,...f.sourceRefs],f.observedAt??null)),
      {metricId:'fact_reconciled_total',id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:null,period:null},
       assumptions:['conflicting totals are never summed or picked silently'],
       exclusions:['all totals excluded while in conflict'],
       warnings,errors,
       trace:`reconciled total: WITHHELD — conflicting totals (${distinctTotals.join(' vs ')}) | lineage: ${lineage.map(l=>`${l.factId} ${l.included?'IN':'OUT'} (${l.reason})`).join(' | ')}`});
  }
  const parent=totals.length===1?totals[0]!:null;
  const children=parent?live.filter(f=>f.relation==='subset'&&f.parentFactId===parent.factId):[];
  let value:number|null=null;
  if(parent){
    const accounted=live.filter(f=>f!==parent&&!children.includes(f));
    for(const f of accounted)lineage.push({factId:f.factId,included:false,reason:`not part of parent total ${parent.factId}`});
    const childSum=children.reduce((t,f)=>t+(f.value??0),0);
    for(const f of children)lineage.push({factId:f.factId,included:true,reason:`verified subset of ${parent.factId}`});
    scopeNote([parent,...children]);
    if(children.length>0&&Math.abs(childSum-(parent.value??0))>1e-9){
      for(const f of [parent,...children]){
        const li=lineage.find(l=>l.factId===f.factId);
        if(li){li.included=false;li.reason=`parent-child mismatch: subsets sum to ${childSum} vs parent ${parent.value} — withheld`;}
      }
      return makeResult('fact_reconciled_total',null,unit,
        facts.map(f=>calcInput(f.factId,f.value,unit,[f.factId,...f.sourceRefs],f.observedAt??null)),
        {metricId:'fact_reconciled_total',id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:null,period:null},
         assumptions:['parent total stands only when subsets reconcile with it'],
         exclusions:['mismatched parent-child sets excluded'],
         warnings,errors,
         trace:`reconciled total: WITHHELD — parent ${parent.value} vs subsets sum ${childSum} | lineage: ${lineage.map(l=>`${l.factId} ${l.included?'IN':'OUT'} (${l.reason})`).join(' | ')}`});
    }
    lineage.push({factId:parent.factId,included:true,reason:children.length>0?`canonical total; subsets reconcile (${childSum})`:'canonical total (no subsets supplied)'});
    value=parent.value;
  } else {
    // No parent total: sum disjoint groups only with explicit confirmation.
    // Single-observation exception: one quantified fact cannot double-count
    // anything, so an independent observation — or the lone surviving revision
    // of its chain — stands as its own canonical total with lineage.
    // A dangling subset cannot (a part is not the whole).
    const summable=live.filter(f=>f.relation==='subset'||f.relation==='independent'||f.relation==='revision');
    if(summable.length===1){
      const only=summable[0]!;
      if(only.relation==='subset'){
        return makeResult('fact_reconciled_total',null,unit,
          facts.map(f=>calcInput(f.factId,f.value,unit,[f.factId,...f.sourceRefs],f.observedAt??null)),
          {metricId:'fact_reconciled_total',id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:null,period:null},
           assumptions:['a part cannot stand as the whole without its parent total or revision chain'],
           exclusions:['dangling subset/revision excluded'],
           warnings,errors,
           trace:`reconciled total: WITHHELD — dangling subset ${only.factId} without its parent total | lineage: ${[...lineage,{factId:only.factId,included:false,reason:'dangling part'}].map(l=>`${l.factId} ${l.included?'IN':'OUT'} (${l.reason})`).join(' | ')}`});
      }
      lineage.push({factId:only.factId,included:true,reason:`single ${only.relation==='revision'?'surviving revision':'quantified observation'} — canonical alone, NOT independently corroborated; no summation performed`});
      return makeResult('fact_reconciled_total',only.value,unit,
        facts.map(f=>calcInput(f.factId,f.value,unit,[f.factId,...f.sourceRefs],f.observedAt??null)),
        {metricId:'fact_reconciled_total',id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:null,period:null},
         assumptions:['a single quantified observation is its own canonical total; this asserts nothing about corroboration'],
         exclusions:['no other facts combined','not an independently corroborated total'],
         warnings,errors,
         trace:`canonical total = ${only.value} ${unit} (single observation ${only.factId}, NOT independently corroborated) | lineage: ${lineage.map(l=>`${l.factId} ${l.included?'IN':'OUT'} (${l.reason})`).join(' | ')}`});
    }
    if(summable.length===0){
      return makeResult('fact_reconciled_total',null,unit,
        facts.map(f=>calcInput(f.factId,f.value,unit,[f.factId,...f.sourceRefs],f.observedAt??null)),
        {metricId:'fact_reconciled_total',id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:null,period:null},
         assumptions:['nothing summable without a parent total or confirmed disjointness'],
         exclusions:['all facts excluded (see lineage)'],
         warnings,errors,
         trace:`reconciled total: WITHHELD — no summable facts | lineage: ${lineage.map(l=>`${l.factId} ${l.included?'IN':'OUT'} (${l.reason})`).join(' | ')}`});
    }
    if(!inp.disjointGroupsConfirmed){
      for(const f of summable)lineage.push({factId:f.factId,included:false,reason:'group overlap unconfirmed — disjointness must be explicitly confirmed before summing'});
      return makeResult('fact_reconciled_total',null,unit,
        facts.map(f=>calcInput(f.factId,f.value,unit,[f.factId,...f.sourceRefs],f.observedAt??null)),
        {metricId:'fact_reconciled_total',id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:null,period:null},
         assumptions:['disjoint groups sum only when non-overlap is explicitly confirmed'],
         exclusions:['unconfirmed groups excluded'],
         warnings,errors,
         trace:`reconciled total: WITHHELD — overlap unconfirmed | lineage: ${lineage.map(l=>`${l.factId} ${l.included?'IN':'OUT'} (${l.reason})`).join(' | ')}`});
    }
    const sum=summable.reduce((t,f)=>t+(f.value??0),0);
    for(const f of summable)lineage.push({factId:f.factId,included:true,reason:'confirmed disjoint group — summed'});
    scopeNote(summable);
    value=Number.isSafeInteger(Math.round(sum))?Math.round(sum):null;
    if(value===null)errors.push('reconciled total is unsafe (overflow)');
  }
  return makeResult('fact_reconciled_total',value,unit,
    facts.map(f=>calcInput(f.factId,f.value,unit,[f.factId,...f.sourceRefs],f.observedAt??null)),
    {metricId:'fact_reconciled_total',id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:null,period:null},
     assumptions:[parent?'canonical parent total with reconciled subsets':'sum of explicitly confirmed disjoint groups',
      'syndicated duplicates counted once; revisions superseded; conflicts withheld'],
     exclusions:['excluded facts listed in trace lineage'],
     warnings,errors,
     trace:value===null?`reconciled total: ${errors.join('; ')}`:`canonical total = ${value} ${unit} | lineage: ${lineage.map(l=>`${l.factId} ${l.included?'IN':'OUT'} (${l.reason})`).join(' | ')}`});
}

// --- B. Recovery Gap Estimation --------------------------------------------

export interface FundingGapInput extends BaseCalculationInput {
  requirement:number|null; available:number|null; currency?:string;
  area?:string; period?:string; programScope?:string;
  requirementStage?:FundingStage; availableStage?:FundingStage;
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
    {id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:inp.area??null,period:inp.period??null},assumptions:[`funding_gap = max(0, requirement − available)`,`currency=${currency}; area=${inp.area??'unspecified'}; period=${inp.period??'unspecified'}; program=${inp.programScope??'unspecified'}`,
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
      {id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:inp.area??null,period:inp.period??null},assumptions:['funding_gap_percent = funding_gap / requirement × 100'],
       warnings:zeroDenom?[...base.warnings,'denominator requirement must be > 0 — percentage withheld (no division by zero)']:base.warnings,
       errors:base.errors,
       trace:'funding_gap_percent: denominator zero/missing — no division by zero'}),
      warnings:base.warnings};
  }
  const pct=roundPct(100*base.value!/inp.requirement!);
  return {...makeResult('funding_gap_percent',pct,'%',
    [calcInput('recovery_requirement',inp.requirement,inp.currency??'IDR',inp.sourceRefs??[],inp.observedAt??null),
     calcInput('available_funding',inp.available,inp.currency??'IDR',[],null)],
    {id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:inp.area??null,period:inp.period??null},assumptions:['funding_gap_percent = funding_gap / requirement × 100'],warnings:base.warnings,errors:[],
     trace:`${base.value} / ${inp.requirement} × 100 = ${pct}%`}),warnings:base.warnings};
}

export interface PhysicalGapInput extends BaseCalculationInput {
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
    {id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:inp.area??null,period:inp.period??null},assumptions:[`physical_gap_count = affected − recovered`,`cohort: ${inp.area??'unspecified'} / ${inp.period??'unspecified'}; requires 0 ≤ recovered ≤ affected`],
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
      {id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:inp.area??null,period:inp.period??null},assumptions:['physical_gap_percent = gap_count / affected × 100'],
       errors:count.errors,
       warnings:zeroDenom?[...count.warnings,'affected denominator must be > 0 — percentage withheld (no division by zero)']:count.warnings,
       trace:'physical_gap_percent: denominator zero/missing — no division by zero'});
  }
  const pct=roundPct(100*count.value!/inp.affectedUnits!);
  return makeResult('physical_gap_percent',pct,'%',
    [calcInput('affected_units',inp.affectedUnits,unit,inp.sourceRefs??[],inp.observedAt??null),
     calcInput('recovered_units',inp.recoveredUnits,unit,[],null)],
    {id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:inp.area??null,period:inp.period??null},assumptions:['physical_gap_percent = gap_count / affected × 100'],warnings:count.warnings,errors:[],
     trace:`${count.value} / ${inp.affectedUnits} × 100 = ${pct}%`});
}

// --- C. Utility Recovery Percentage -----------------------------------------

export interface UtilityRecoveryInput extends BaseCalculationInput {
  service:'water'|'electricity'|'access'|'telecom';
  affected:number|null; recovered:number|null;
  /** Unit actually observed by the source. When supplied, must equal the
   *  service's canonical unit; mismatch is rejected, never coerced. */
  unit?:string|null;
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
  if(inp.unit&&inp.unit!==expectedUnit)
    errors.push(`observed unit "${inp.unit}" ≠ canonical unit "${expectedUnit}" for ${inp.service} — units are never mixed or coerced`);
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
    {id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:inp.area??null,period:inp.period??null},assumptions:[`recovery_percent = recovered / affected × 100`,`service=${inp.service}; unit=${expectedUnit} (never mixed across services)`,
        `cohort/boundary/period: ${inp.area??'unspecified'} / ${inp.period??'unspecified'}`,
        `operational = ${inp.operationalDefinition??'source-defined (unstated)'}`],
     exclusions:['other services excluded (no cross-service numerator/denominator)','partial/inconsistent samples excluded from regional claims'],
     warnings,errors,
     trace:value===null?`utility_recovery(${inp.service}): ${errors.join('; ')||'insufficient inputs'}`:`${inp.recovered}/${inp.affected} × 100 = ${value}% (${inp.service})`});
}

// --- C2. Utility Recovery Index (ORI, internal composite) ---------------------------
// ORI = 0.30·water + 0.25·electricity + 0.25·access + 0.20·telecom.
// Proposed internal composite (PDF A3 PAR-ORI-WEIGHTS). An ORI value is an
// index, NOT a direct percentage of the population recovered.

export const ORI_VERSION='ori-composite-v1.0';
/** Centrally-defined ORI weights. Must sum to 1 (tested). */
export const ORI_WEIGHTS={water:0.30,electricity:0.25,access:0.25,telecom:0.20} as const;
export function oriWeightsSum():number{
  return ORI_WEIGHTS.water+ORI_WEIGHTS.electricity+ORI_WEIGHTS.access+ORI_WEIGHTS.telecom;
}

export interface OriServiceInput extends BaseCalculationInput {
  service:'water'|'electricity'|'access'|'telecom';
  affected:number|null; recovered:number|null;
  /** Unit actually observed. Must equal the service's canonical unit. */
  unit?:string|null;
  area?:string|null; period?:string|null;
  operationalDefinition?:string|null;
  temporaryRestoration?:boolean|null;
}

export interface OriIndexInput extends BaseCalculationInput {
  components:OriServiceInput[];
}

/** Composite ORI across exactly the four utility services. */
export function estimateOriIndex(inp:OriIndexInput):CalculationResult{
  const errors:string[]=[];const warnings:string[]=[
    'ORI is an internal composite index (0–100 scale), NOT a direct percentage of the population recovered.'];
  const seen=new Set<string>();
  const perService=new Map<string,CalculationResult>();
  for(const c of inp.components){
    if(seen.has(c.service))errors.push(`duplicate service entry: ${c.service} supplied twice`);
    seen.add(c.service);
    const expected=UTILITY_UNITS[c.service]??'units';
    if(c.unit!==null&&c.unit!==undefined&&c.unit!==expected)
      errors.push(`unit mismatch for ${c.service}: observed '${c.unit}' vs required '${expected}' — services are never mixed`);
    const r=estimateUtilityRecovery({service:c.service,affected:c.affected,recovered:c.recovered,
      area:c.area??undefined,period:c.period??undefined,sourceRefs:c.sourceRefs??[],
      observedAt:c.observedAt??null,operationalDefinition:c.operationalDefinition??null,
      temporaryRestoration:c.temporaryRestoration??null});
    perService.set(c.service,r);
    if(r.status!=='calculated')errors.push(`${c.service}: component unavailable (${r.status}) — ${r.errors.concat(r.warnings.filter(w=>/denominator|exceeds/i.test(w))).join('; ')||r.trace}`);
  }
  const required=['water','electricity','access','telecom'] as const;
  const missing=required.filter(k=>!perService.has(k)||perService.get(k)!.status!=='calculated');
  // Documented missing-data policy: withhold. Weights are NOT redistributed
  // silently — no redistribution policy is established.
  if(missing.length>0&&errors.length===0)
    return makeResult('utility_ori_index',null,'index 0–100',
      inp.components.flatMap(c=>[calcInput(`affected_${c.service}`,c.affected,UTILITY_UNITS[c.service]??'units',c.sourceRefs??[],c.observedAt??null),
        calcInput(`recovered_${c.service}`,c.recovered,UTILITY_UNITS[c.service]??'units',[],null)]),
      {metricId:'ori_index',id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:null,period:null},
       assumptions:['ORI = 0.30·water + 0.25·electricity + 0.25·access + 0.20·telecom',
        'missing categories are withheld, never re-weighted without an explicit redistribution policy'],
       exclusions:['not a population-recovered percentage'],
       warnings:[...warnings,`missing/unavailable categories (${missing.join(', ')}) — index withheld`],errors:[],
       trace:`ORI: insufficient inputs — missing ${missing.join(', ')}`});
  // Scope compatibility across components (when declared).
  const areas=[...new Set(inp.components.map(c=>c.area).filter((a):a is string=>!!a))];
  const periods=[...new Set(inp.components.map(c=>c.period).filter((x):x is string=>!!x))];
  if((areas.length>1||periods.length>1)&&errors.length===0){
    return makeResult('utility_ori_index',null,'index 0–100',
      inp.components.flatMap(c=>[calcInput(`affected_${c.service}`,c.affected,UTILITY_UNITS[c.service]??'units',c.sourceRefs??[],c.observedAt??null)]),
      {metricId:'ori_index',id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:null,period:null},
       assumptions:['ORI components must share geography and reporting period'],
       exclusions:['not a population-recovered percentage'],
       warnings:[...warnings,`scope mismatch across components (areas: ${areas.join(', ')||'—'}; periods: ${periods.join(', ')||'—'}) — index withheld`],
       errors:[],trace:'ORI: withheld — component scopes differ'});
  }
  let value:number|null=null;
  if(errors.length===0){
    const w=perService.get('water')!.value!,e=perService.get('electricity')!.value!,
      a=perService.get('access')!.value!,t=perService.get('telecom')!.value!;
    value=roundPct(ORI_WEIGHTS.water*w+ORI_WEIGHTS.electricity*e+ORI_WEIGHTS.access*a+ORI_WEIGHTS.telecom*t);
    if(value===null)errors.push('ORI result is unsafe');
  }
  const scopeAreas=[...new Set(inp.components.map(c=>c.area).filter((a):a is string=>!!a))];
  const scopePeriods=[...new Set(inp.components.map(c=>c.period).filter((x):x is string=>!!x))];
  return makeResult('utility_ori_index',value,'index 0–100',
    (['water','electricity','access','telecom'] as const).flatMap(k=>[
      calcInput(`${k}_recovery_pct`,perService.get(k)!.value,'%',[],null)]),
    {metricId:'ori_index',id:inp.calculationId??null,origin:inp.origin??'unknown',
     scope:{area:scopeAreas.length===1?scopeAreas[0]!:null,period:scopePeriods.length===1?scopePeriods[0]!:null},
     assumptions:['ORI = 0.30·water + 0.25·electricity + 0.25·access + 0.20·telecom',
      `version=${ORI_VERSION}; weights sum=${oriWeightsSum()}`,
      'each component validated (units, scope, denominators) before aggregation'],
     exclusions:['not a population-recovered percentage','missing categories withheld, never silently re-weighted'],
     warnings,errors,
     trace:value===null?`ORI: ${errors.join('; ')||'insufficient inputs'}`:
      `0.30×${perService.get('water')!.value}+0.25×${perService.get('electricity')!.value}+0.25×${perService.get('access')!.value}+0.20×${perService.get('telecom')!.value} = ${value} (index)`});
}

// --- D. Disaster Needs Intelligence ------------------------------------------

export interface NeedsDemandInput extends BaseCalculationInput {
  targetPopulation:number|null; dailyRequirementPerPerson:number|null; durationDays:number|null;
  commodity?:string; unit?:string; area?:string; period?:string;
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
    {id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:inp.area??null,period:inp.period??null},assumptions:[`demand = population × daily_rate × days`,`commodity=${inp.commodity??'unspecified'}; unit=${unit}; area=${inp.area??'unspecified'}; period=${inp.period??'unspecified'}`,
        'constant population over horizon; single commodity+unit'],
     exclusions:['backlog handled in forecast gap, not here'],
     errors,trace:value===null?`demand: ${errors.join('; ')||'insufficient inputs — target population/commodity/unit/duration/source required'}`:`${inp.targetPopulation} × ${inp.dailyRequirementPerPerson} × ${inp.durationDays} = ${value} ${unit}`});
}

// --- D0. Current needs gap (horizon-less) -------------------------------------------
// CurrentGap = MAX(0, PopulationNeeding × Rate − UsableSupply).
// Point-in-time gap for the current period. Unlike the forecast gap this has
// NO duration/horizon factor and NO backlog/incoming terms: supply counted here
// must already be usable and distributable now.

export interface CurrentGapInput extends BaseCalculationInput {
  populationNeeding:number|null;
  ratePerPerson:number|null;
  usableSupply:number|null;
  /** Commodity unit, e.g. 'portions'. Demand and supply must share it. */
  unit?:string;
  /** Observed unit of the supply figure. Must equal `unit` when specified. */
  supplyUnit?:string|null;
  commodity?:string|null; area?:string|null; period?:string|null;
  /** Explicit usability confirmation. false withholds (blocker). */
  supplyConfirmedUsable?:boolean|null;
  /** Distribution history for this commodity/period (never counted as stock). */
  distributedHistory?:number|null;
}

export function estimateCurrentGap(inp:CurrentGapInput):CalculationResult{
  const errors:string[]=[];const warnings:string[]=[];
  negErr('population needing',inp.populationNeeding,errors);
  negErr('rate per person',inp.ratePerPerson,errors);
  negErr('usable supply',inp.usableSupply,errors);
  const unit=inp.unit??'units';
  if(inp.supplyUnit!==null&&inp.supplyUnit!==undefined&&inp.supplyUnit!==unit)
    errors.push(`incompatible units: demand in '${unit}' vs supply in '${inp.supplyUnit}' — same commodity, population scope and period required`);
  if(inp.supplyConfirmedUsable===false)
    warnings.push('supply not confirmed usable and distributable now — current gap withheld until usability is evidenced');
  if(inp.distributedHistory!==null&&inp.distributedHistory!==undefined&&Number.isFinite(inp.distributedHistory)&&inp.distributedHistory>0)
    warnings.push(`distribution history (${inp.distributedHistory}) is reported movement, not current usable stock — excluded`);
  const usabilityBlocked=inp.supplyConfirmedUsable===false;
  const missing=isMissing(inp.populationNeeding)||isMissing(inp.ratePerPerson)||isMissing(inp.usableSupply);
  if((missing||usabilityBlocked)&&errors.length===0){
    return makeResult('needs_current_gap',null,unit,
      [calcInput('population_needing',inp.populationNeeding,'people',inp.sourceRefs??[],inp.observedAt??null),
       calcInput('rate_per_person',inp.ratePerPerson,`${unit}/person`,[],null),
       calcInput('usable_supply',inp.usableSupply,unit,[],null)],
      {id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:inp.area??null,period:inp.period??null},
       assumptions:[`current_gap = max(0, population × rate − usable_supply)`,
        `commodity=${inp.commodity??'unspecified'}; unit=${unit}; area=${inp.area??'unspecified'}; period=${inp.period??'unspecified'}`,
        'point-in-time: no horizon factor, no backlog, no incoming — use the forecast gap for future horizons'],
       exclusions:['distribution history excluded from stock','horizon/backlog/incoming belong to the forecast gap'],
       warnings,errors,
       trace:usabilityBlocked?'current_gap: withheld — supply usability uncertain (see blockers)':'current_gap: insufficient inputs — population, rate and usable supply required (never zero-filled)'});
  }
  let value:number|null=null;
  if(errors.length===0){
    const raw=inp.populationNeeding!*inp.ratePerPerson!-inp.usableSupply!;
    if(!Number.isFinite(raw))errors.push('current gap result is unsafe');
    else value=Math.max(0,Math.round(raw*100)/100);
  }
  return makeResult('needs_current_gap',value,unit,
    [calcInput('population_needing',inp.populationNeeding,'people',inp.sourceRefs??[],inp.observedAt??null),
     calcInput('rate_per_person',inp.ratePerPerson,`${unit}/person`,[],null),
     calcInput('usable_supply',inp.usableSupply,unit,[],null)],
    {id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:inp.area??null,period:inp.period??null},
     assumptions:[`current_gap = max(0, population × rate − usable_supply)`,
      `commodity=${inp.commodity??'unspecified'}; unit=${unit}; area=${inp.area??'unspecified'}; period=${inp.period??'unspecified'}`],
     exclusions:['distribution history excluded from stock'],
     warnings,errors,
     trace:value===null?`current_gap: ${errors.join('; ')}`:`max(0, ${inp.populationNeeding} × ${inp.ratePerPerson} − ${inp.usableSupply}) = ${value} ${unit}`});
}

export interface ForecastGapInput extends BaseCalculationInput {
  demand:number|null; additionalBacklog:number|null;
  usableStock:number|null; expectedIncoming:number|null;
  unit?:string; area?:string; period?:string;
  /** True when the backlog window overlaps the demand window (double-count). */
  backlogOverlapsDemand?:boolean;
  /** Distribution history for this commodity/period (never counted as stock). */
  distributedHistory?:number|null;
  /** Explicit usability confirmation. false withholds the forecast (blocker);
      null/undefined keeps the stated value (backward compatible). */
  usableStockConfirmed?:boolean|null;
  /** Explicit incoming-supply confirmation (scoped, committed supply). false
      withholds the forecast (blocker). */
  incomingConfirmed?:boolean|null;
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
  // Usability blockers: uncertain stock/incoming withholds the forecast rather
  // than letting an unusable or unconfirmed figure complete the calculation.
  if(inp.usableStockConfirmed===false)
    warnings.push('usable stock not confirmed usable (expired/inaccessible/unscoped) — forecast withheld until usability is evidenced');
  if(inp.incomingConfirmed===false)
    warnings.push('incoming supply unconfirmed or out of scope (location/category/period) — forecast withheld until confirmed');
  const usabilityBlocked=inp.usableStockConfirmed===false||inp.incomingConfirmed===false;
  const missing=isMissing(inp.demand)||isMissing(inp.additionalBacklog)||isMissing(inp.usableStock)||isMissing(inp.expectedIncoming);
  if((missing||usabilityBlocked)&&errors.length===0){
    // Per spec: incomplete inputs -> insufficient_data, never assume zero.
    // Uncertain usability likewise withholds (blocker shown, not invented).
    return makeResult('needs_forecast_gap',null,inp.unit??'units',
      [calcInput('demand',inp.demand,inp.unit??'units',inp.sourceRefs??[],inp.observedAt??null),
       calcInput('additional_backlog',inp.additionalBacklog,inp.unit??'units',[],null),
       calcInput('usable_stock',inp.usableStock,inp.unit??'units',[],null),
       calcInput('expected_incoming',inp.expectedIncoming,inp.unit??'units',[],null)],
      {id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:inp.area??null,period:inp.period??null},
       assumptions:['forecast_gap = max(0, demand + backlog − usable_stock − incoming)','only usable/unexpired/accessible stock; only scoped incoming supply'],
       exclusions:['distribution history excluded from stock','requested/committed/received/distributed stages never conflated with remaining stock'],
       warnings,errors,
       trace:usabilityBlocked?'forecast_gap: withheld — stock usability or incoming confirmation uncertain (see blockers)':'forecast_gap: insufficient inputs — explicit backlog/stock/incoming required (no silent zero)'});
  }
  let value:number|null=null;
  if(errors.length===0)value=Math.max(0,inp.demand!+inp.additionalBacklog!-inp.usableStock!-inp.expectedIncoming!);
  return makeResult('needs_forecast_gap',value,inp.unit??'units',
    [calcInput('demand',inp.demand,inp.unit??'units',inp.sourceRefs??[],inp.observedAt??null),
     calcInput('additional_backlog',inp.additionalBacklog,inp.unit??'units',[],null),
     calcInput('usable_stock',inp.usableStock,inp.unit??'units',[],null),
     calcInput('expected_incoming',inp.expectedIncoming,inp.unit??'units',[],null)],
    {id:inp.calculationId??null,origin:inp.origin??'unknown',scope:{area:inp.area??null,period:inp.period??null},
     assumptions:['forecast_gap = max(0, demand + backlog − usable_stock − incoming)','backlog = unmet demand OUTSIDE the current demand window'],
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
      {id:null,origin:'unknown',scope:{area:null,period:null},
       assumptions:[`score = 100 × (0.30·S + 0.25·G + 0.20·V + 0.15·T + 0.10·A)`,`version=${PRIORITY_VERSION}`,
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
    {id:null,origin:'unknown',scope:{area:null,period:null},
     assumptions:[`score = 100 × (0.30·S + 0.25·G + 0.20·V + 0.15·T + 0.10·A)`,`version=${PRIORITY_VERSION}; weights sum=${sum}`,
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
