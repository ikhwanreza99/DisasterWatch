# Disaster insights v1 implementation

Based on DisasterWatch_Panduan_Pengolahan_Data_dan_Baseline_v1.md (15 October 2026).

- Candidate needs are hazard taxonomy UNION evidence-triggered categories. Potential is never confirmed shortage. Reports are restricted to the exact incident ID; unknown IDs are not assigned to the current incident.
- Compact category rows use collapsible source details. Narrative deliveries retain packaging and publisher attribution, and never become usable stock automatically.
- Typed pure functions implement damage, net economic flow loss, total assessed impact, funding gap, physical gap percentage, utility recovery, constant-population scenario forecast and heuristic priority. Missing/nonfinite/negative values and scope/unit/period mismatches return null. Utility recovery requires affected > 0 and restored <= affected.
- The explicit scenario calculator component exists but is intentionally not mounted in the UI (product decision: it confused users). It has no prefilled synthetic data and is not reachable from the detail view.
- Actual article facts do not currently supply comparable loss inputs, usable stock, allocated funds, or utility denominators. Actual values remain unavailable. Beneficiaries of one delivery are not assumed to be the whole displaced population.
- Calculator is local and does not persist assessment runs. Automatic extraction/resolution of these additional inputs and immutable Firestore calculation storage are not implemented by this UI change. Existing narrative Firestore records and source snapshots remain unchanged.
- Input fact IDs and method version are preserved by arithmetic outputs; scenario IDs are explicitly synthetic. No estimate is promoted into an observed field.

Run: `node --import tsx --test tests/insightFormulas.test.ts tests/insightCalculator.test.tsx`.
