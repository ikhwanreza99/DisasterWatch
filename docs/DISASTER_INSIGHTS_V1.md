# Disaster insights v1 implementation

Based on DisasterWatch_Panduan_Pengolahan_Data_dan_Baseline_v1.md (15 October 2026).

- Candidate needs are hazard taxonomy UNION evidence-triggered categories. Potential is never confirmed shortage. Reports are restricted to the exact incident ID; unknown IDs are not assigned to the current incident.
- Compact category rows use collapsible source details. Narrative deliveries retain packaging and publisher attribution, and never become usable stock automatically.
- Typed pure functions implement damage, net economic flow loss, total assessed impact, funding gap, physical gap percentage, utility recovery, constant-population scenario forecast and heuristic priority. Missing/nonfinite/negative values and scope/unit/period mismatches return null. Utility recovery requires affected > 0 and restored <= affected.
- The explicit scenario calculator component exists but is intentionally not mounted in the UI (product decision: it confused users). It has no prefilled synthetic data and is not reachable from the detail view.
- Actual article facts do not currently supply comparable loss inputs, usable stock, allocated funds, or utility denominators. Actual values remain unavailable. Beneficiaries of one delivery are not assumed to be the whole displaced population.
- Calculator is local and does not persist assessment runs. Automatic extraction/resolution of these additional inputs and immutable Firestore calculation storage are not implemented by this UI change. Existing narrative Firestore records and source snapshots remain unchanged.
- Input fact IDs and method version are preserved by arithmetic outputs; scenario IDs are explicitly synthetic. No estimate is promoted into an observed field.
- Severity accepts an explicit unit: fraction 0–1 (default) or percent 0–100 with declared conversion (50% → 0.5). A bare 50 in fraction mode is `invalid_input`, never silently rescaled. The incident calculator exposes this as a Fraksi/Persen selector.
- Economic loss records its basis: `net` (guideline default, loss after coping) vs `gross` (total output lost), plus the net-flow derivation `max(0, normal − actual) × days`. The two are never confused in traces.
- Every `CalculationResult` carries an optional correlation `id`, an explicit `origin` (`simulation`/`live`/`unknown`), and the declared `scope` (area/period). `estimateTotalLoss` withholds automatically when component scopes differ, in addition to the manual overlap flag. Duplicate source refs in one calculation raise a warning.
- Forecast gap withholds on uncertain usability: `usableStockConfirmed=false` or `incomingConfirmed=false` yields `insufficient_data` with a blocker message. Distribution history remains excluded from stock.
- Priority weights verified 0.30/0.25/0.20/0.15/0.10 (sum exactly 1.00, `priority-mvp-v1.0`); no duplicate or ambiguous access terms — `A` is solely the access-barrier component. Override triggers urgent assessment only.

Run: `node --import tsx --test tests/insightFormulas.test.ts tests/insightCalculator.test.tsx`.
