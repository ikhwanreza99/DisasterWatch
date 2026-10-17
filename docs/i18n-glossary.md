# Localization (ID/EN) glossary & rules

DisasterWatch is bilingual Indonesian (ID) / English (EN). English is the default
for new visits; the choice is persisted in `localStorage` under `dw:lang`.

## Architecture

- Indonesian is the **source language and the translation key**. Write UI copy in
  Indonesian; add the English value to the matching slice in
  `src/i18n/translations/*.ts` (merged into `en` by `src/i18n/translations.ts`).
- Missing keys fall back to the Indonesian source string, so an omission is
  visible rather than blank.
- Use `t('...')` / `translate('...')` from `src/i18n`; interpolation is `{name}`
  (see `interpolate`). `useI18n()` exposes `{ t, lang, locale, setLang }`.
- `translateStatusText(value, t)` in `src/i18n/statusText.ts` maps dynamic
  status strings (exact key first, then regex→key templates).
- `aidAssumptionText(text, lang)` in `src/i18n/incidentText.ts` translates
  narrative aid-allocation assumptions.

## Terminology (ID → EN)

| Indonesian | English | Notes |
| --- | --- | --- |
| bencana | disaster | |
| gempa bumi / gempabumi | earthquake | |
| banjir | flood | |
| banjir bandang | flash flood | |
| tanah longsor | landslide | |
| kebakaran hutan dan lahan | forest and land fire | |
| kekeringan | drought | |
| cuaca ekstrem | extreme weather | |
| korban jiwa | fatalities | never invent; only verified figures |
| terdampak | affected | |
| pengungsi | displaced people | |
| posko / titik pengungsian | aid post / shelter | |
| jalur evakuasi | evacuation route | |
| kebutuhan | needs | |
| bantuan | aid | |
| pemenuhan | fulfilment | |
| sisa | remaining | |
| estimasi | estimated | |
| terverifikasi | verified | |
| belum tersedia | not yet available | |
| tidak diketahui | unknown | |
| simulasi sintetis | synthetic simulation | |
| kode sumber | source code | provenance label on `/calculation` |
| keyakinan | confidence | AI answers |
| ringkasan | summary | |

## Keep unchanged (do not translate)

- Data, not UI: `src/data/**`, database fields, API keys, schema names,
  internal identifiers, and prompts/model-facing context
  (e.g. `src/services/ai/disasterAssistantContext.ts`, `helpdeskAgent.ts`).
- Proper nouns / brands: BMKG, NASA FIRMS, MAGMA Indonesia (PVMBG),
  Darwin VAAC (BOM), Google Weather/Air Quality, DisasterWatch, DisasterAI.
- Source names carry a `(source)` grouping even when the label is translated
  (e.g. `Sumber: NASA FIRMS` → `Source: NASA FIRMS`).

## Verification

- `tests/i18nIntegrity.test.tsx` scans every `t()`/`translate()` literal key
  (plus `statusText.ts` rule keys) and asserts:
  1. each key exists in `en`,
  2. no English value is empty,
  3. ID key and EN value use identical `{placeholder}` sets,
  4. `aidAssumptionText` localizes without changing units/factors,
  5. `/calculation` renders Indonesian by default and fully English for EN.
- Run: `npm test`, `npm run lint`, `npm run build`.

## Known non-UI residuals

Unreachable components and internal strings are intentionally left in
Indonesian by design (see the localization report). They are not part of any
rendered route and can be migrated if/when they are wired up.
