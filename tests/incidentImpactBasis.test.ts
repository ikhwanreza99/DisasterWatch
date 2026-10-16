import {test} from 'node:test';import assert from 'node:assert/strict';
import {incidentImpactBasis,latestImpactReport} from '../src/services/insights/incidentImpactBasis';
import {estimateHousingDamage} from '../src/services/insights/impactEstimate';
test('Pesisir Selatan and Padang use reported houses rather than allocated provincial totals',()=>{assert.equal(incidentImpactBasis('pesisir-selatan-2026-10').homes,6);assert.equal(estimateHousingDamage(incidentImpactBasis('pesisir-selatan-2026-10').homes!,100e6,.3),180e6);assert.equal(incidentImpactBasis('padang').homes,125);assert.equal(estimateHousingDamage(incidentImpactBasis('padang').homes!,100e6,.3),3750e6);});
test('both cards select the latest report regardless of stored order',()=>{assert.equal(latestImpactReport([{date:'2026-10-12',value:0},{date:'2026-10-10',value:7}])?.value,0);assert.equal(incidentImpactBasis('missing').homes,null);});
