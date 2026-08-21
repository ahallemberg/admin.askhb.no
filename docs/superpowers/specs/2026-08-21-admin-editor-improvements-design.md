# Admin editor improvements — structured dates, page picker, live preview, unsaved guard

Date: 2026-08-21
Repo: `admin.askhb.no` (askhb.no is **not** modified by this work)

## Problem

The editor's `Date` field is free text in both the Experience and Education dialogs. Typing it by hand has already produced inconsistent live data:

```
experiences:  "Jun. 2026 - Aug. 2026"   "Apr. 2024 - Sep. 2025"   "2019 - 2023"
education:    "Sep. 2026 - aug. 2027"   "Aug. 2023 - jun. 2028"   "Aug. 2020 - jun. 2023"
```

All three education entries have a lowercase second month. One experience is year-only.

Three related weaknesses in the same dialogs:

- `readMoreUrl` is free text. A URL under `askhb.no/...` silently lands on the portfolio home page instead of 404ing, so a typo is invisible. Only 2 of 7 experiences currently link a page, while 7 pages are published — `Q-Free`, `Ascend-NTNU`, `Ascend-NTNU---Perception-Engineer`, `Ascend-NTNU---Deputy-Chief-Engineer` and `Web-Development` are unlinked.
- There is no way to see how an entry renders on askhb.no without saving and reloading the live site.
- Edits are lost silently: closing a dialog discards its draft with no confirmation, and closing the tab discards unsaved editor state with no warning.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Data model | Keep `date` **and** add structured fields | askhb.no needs no change and no deploy; no risk to the live render |
| Source of truth | `dateRange` is authoritative; `date` is derived | `date` is recomputed on every change and is never directly editable, so the two cannot drift from the UI |
| Format | `Apr. 2024 - Sep. 2025` | Matches 5 of 7 existing experience entries, so the site's appearance does not shift |
| Supported shapes | range, ongoing, no-end, year-only | Mixed precision (`2019 - Sep. 2023`) is explicitly excluded |
| `readMoreUrl` | Strict dropdown | Makes the `askhb.no/...` mistake unreachable |
| Preview placement | Side-by-side, sticky | Editing is desktop-only, so a wide modal costs nothing |
| Delivery | Four sequential PRs | Repo convention is short-lived branches merged via PR |

## Data model

`src/types/props.ts`:

```ts
interface DateParts { year: number; month?: number }   // month 1-12; absent = year-only precision
interface DateRange { start: DateParts; end?: DateParts; ongoing?: boolean }
```

`dateRange?: DateRange` is added to both `ExperienceItem` and `EducationItem`. It is optional, so existing R2 JSON stays valid.

Stored shape:

```json
{
  "date": "Apr. 2024 - Sep. 2025",
  "dateRange": { "start": { "year": 2024, "month": 4 }, "end": { "year": 2025, "month": 9 } }
}
```

Nested under one key rather than four loose top-level fields so `ongoing` stays scoped to the dates it qualifies.

### Shape mapping

| Shape | `dateRange` | Rendered `date` |
|---|---|---|
| Range | `start{y,m}`, `end{y,m}` | `Apr. 2024 - Sep. 2025` |
| Ongoing | `start{y,m}`, `ongoing: true` | `Apr. 2024 - today` |
| No end | `start{y,m}` | `Jun. 2025` |
| Year-only | `start{y}`, `end{y}` | `2019 - 2023` |

"Ongoing" and "no end" both omit `end`; the `ongoing` flag distinguishes them, so the mapping is unambiguous in both directions.

### Format rules

- Months: `Jan. Feb. Mar. Apr. May Jun. Jul. Aug. Sep. Oct. Nov. Dec.`
- `May` takes no period — it is not an abbreviation.
- Separator is a spaced hyphen: `" - "`.
- Ongoing end renders as the literal `today`.

### askhb.no contract

askhb.no's `src/types/props.ts` is intentionally **not** updated. It casts fetched JSON without runtime validation and ignores unknown keys, so the extra field is inert there. The two type files therefore differ on purpose; this is recorded in the admin `CLAUDE.md` so the divergence is not later "fixed" by mistake.

## Feature 1 — Date pickers

**New:** `src/func/dates.ts` (2-space indent, matching `src/func/`)

- `MONTHS` — the abbreviation table above.
- `formatDateRange(range: DateRange): string` — the single place that produces `date`.
- `parseDateString(date: string): DateRange | null` — case-insensitive, so `aug. 2027` parses. Handles all four shapes plus `today` / `present` / `now` as ongoing markers. Returns `null` when it cannot parse.

**New:** `src/components/DateRangePicker.tsx` (4-space indent, matching `src/components/`)

Props: `value: DateRange | undefined`, `fallbackText: string`, `onChange: (range: DateRange) => void`.

Controls:

- Start: `[Month ▾] [Year ▾]`
- End: `[Month ▾] [Year ▾]`
- **End mode**, 3-way: `End date` / `Ongoing` / `No end`. A single control rather than two checkboxes, so a contradictory state (both "ongoing" and "no end") is unreachable by construction.
- **Year only** checkbox — blanks and disables *both* month dropdowns together, which enforces the no-mixed-precision rule structurally rather than through validation. Ticking it drops any months already chosen; unticking it leaves both month dropdowns empty to be re-picked. Years are untouched either way.

Year dropdown range: 1980 through current year + 10 (live data spans 2019–2028).

**Legacy entries.** No entry has `dateRange` yet, so the picker calls `parseDateString(item.date)` on open. On a successful parse the pickers populate. On `null`:

- the pickers open empty,
- `fallbackText` (the original `date`) is displayed with a note that it could not be parsed,
- `date` is **left untouched** unless the user actively sets the pickers.

A date the parser does not understand is never silently overwritten or blanked.

## Feature 2 — readMoreUrl dropdown

**New:** `src/func/pages.ts`

`fetchPublishedPages(): Promise<PageOption[]>` — fetches `https://pages.askhb.no/static/contentIndex.json` (public, `access-control-allow-origin: *`, ~12 KB), drops the `index` redirect stub, maps each entry to `{ slug, title, url }` where `url` is `https://pages.askhb.no/<slug>`, sorted by title.

The URL constant goes in `src/constants/app.ts` alongside the existing R2 and worker URLs.

**Fetched once in `PortfolioEditor` and passed down, deliberately outside the load gate.** Save is gated on the three R2 fetches succeeding. Folding a fourth fetch into that gate would let a Quartz outage block saving entirely. It gets its own state; failure degrades this one field and nothing else.

**New:** `src/components/ReadMoreUrlSelect.tsx`

Strict select — arbitrary URLs cannot be typed. Options are `None` plus each published page by title.

Two cases must not cause data loss:

- **Current value absent from the index** (renamed or unpublished page, or a legacy `askhb.no/...` URL): rendered as a preselected `⚠ Not found: <url>` option. Opening and saving an entry therefore cannot silently clear a working link.
- **Fetch failed**: the select renders `disabled`, showing the current value, with a note that pages could not be loaded from pages.askhb.no.

## Feature 3 — Live preview

**New:** `src/components/ExperiencePreview.tsx`, `src/components/EducationPreview.tsx`

These mirror askhb.no's `src/components/ExperienceItem.tsx` and `EducationItem.tsx`, minus the `FadeIn` wrapper and the dark-mode classes (this app has no dark mode). Both files carry a header comment naming the file they mirror.

Known trade-off: this duplicates markup owned by another repo, so restyling the portfolio card will make the preview stale. Accepted — the alternative is a shared package, which is disproportionate for two small components.

**Modified:** both dialogs

- `max-w-2xl` → `max-w-5xl`
- Body becomes `grid lg:grid-cols-2 gap-6`; fields left, preview right
- Preview column is `lg:sticky lg:top-0 self-start`
- Single column below `lg` — near-free, though editing is desktop-only

The preview renders from `tempItem`, so it tracks every keystroke.

Its date line changes hands between PRs: in PR 1 it renders `tempItem.date` directly, because `formatDateRange` does not exist yet. PR 2 switches it to `formatDateRange` applied to the in-progress picker state, so from then on the preview shows exactly what will be written.

## Feature 4 — Unsaved-changes guard

**New:** `src/func/compare.ts` — a small recursive `deepEqual`, key-order independent and treating an absent key as equal to an explicit `undefined`. Key order is the reason `JSON.stringify` comparison will not do: every edit path rebuilds objects with `{...prev}`, and a spread that reorders keys would register as an unsaved change. (`JSON.stringify` handles the `undefined` case correctly on its own — it omits undefined-valued keys — so that is not the deciding factor.)

Four parts:

1. **Dialog close.** Both dialogs deep-compare `tempItem` against the incoming prop; the Experience dialog also counts a skill typed but not yet added. ✕ or Cancel with changes present triggers `window.confirm('Discard changes to this entry?')`. A blocking dialog, consistent with the `alert()` already used in `savePortfolio`. There is no backdrop or Escape handler to guard — the modal's overlay has no click handler and nothing listens for keydown.
2. **Tab close.** A `beforeunload` handler in `PortfolioEditor`, registered only while dirty and removed when clean.
3. **Dirty indicator.** An "Unsaved changes" marker beside the Save button. Dirty state is a deep comparison against a snapshot taken on successful load and reset after a fully successful save.
4. **Partial save reporting.** `savePortfolio` performs three independent PUTs with no transaction. It collects per-file results with `Promise.allSettled` and reports *which* of the three failed by name. `allSettled` rather than `all` matters: `fetch` rejects on a network-level failure, and `Promise.all` would abandon the other two PUTs without cancelling them — they can still reach R2, so reporting "nothing was saved" would be the opposite of the truth. A failed save also sets a `saveFailed` flag that keeps the editor marked dirty even when the user had made no edits of their own, so a mixed R2 state stays visibly unsaved.

**All three existing save guards are preserved unchanged**: the Save button's `isLoading || loadError` check, the same check inside `savePortfolio`, and the conditional render of the editor body. R2 has no versioning and the worker no DELETE, so a regression here is unrecoverable.

## File inventory

New:

```
src/func/dates.ts
src/func/pages.ts
src/func/compare.ts
src/components/DateRangePicker.tsx
src/components/ReadMoreUrlSelect.tsx
src/components/ExperiencePreview.tsx
src/components/EducationPreview.tsx
```

Modified:

```
src/types/props.ts          + DateParts, DateRange, dateRange on both item types
src/constants/app.ts        + contentIndex URL
src/components/ExperienceDialog.tsx
src/components/EducationDialog.tsx
src/pages/PortfolioEditor.tsx
CLAUDE.md                   document the additive field and the intentional type divergence
.gitignore                  + .superpowers/
```

## PR sequence

1. **Widen dialogs + live preview.** First because it restructures the dialog JSX; doing it last would conflict with everything else.
2. **Date pickers.**
3. **readMoreUrl dropdown.**
4. **Unsaved-changes guard.**

Each gets its own Cloudflare Pages preview deploy to click through before merging. Plain commit messages and PR bodies — no attribution trailers.

## Migration consequence

The first Save after PR 2 ships is a content migration, not an ordinary save. All 10 entries gain a `dateRange`, and three education dates are rewritten (`aug.` → `Aug.`, `jun.` → `Jun.`). Because Save writes all three files wholesale, this touches every entry, not just the edited one.

The editor says so rather than leaving it implicit. Load-time normalisation is compared against the raw fetch, and when they differ the header shows "Date formats will be updated on the next save". This is deliberately separate from the "Unsaved changes" indicator: folding it into the dirty flag would light that indicator on every page load and fire `beforeunload` on every tab close, training the user to ignore both. Leaving it unsaid entirely would be worse — the rewrite would then ride along silently with whatever unrelated edit happened to be saved first, possibly weeks later.

## Verification

No test framework is configured, and none is being added.

- `npm run build` — type-checks under `strict` plus `noUnusedLocals` / `noUnusedParameters`, so an unused import fails the build.
- `npm run lint`
- Manual pass in `npm run dev`: open both dialogs, confirm each of the four date shapes round-trips, confirm the legacy `"2019 - 2023"` and `"Aug. 2023 - jun. 2028"` strings parse, confirm the dropdown lists all 7 pages and excludes `index`, confirm the preview tracks edits, confirm each of the four guard paths.

No claim of working behaviour is made until the build has been run and the dialogs clicked through.

## Out of scope

- Any change to the askhb.no repo.
- Date-based sorting of entries; ordering stays manual via `DraggableList`.
- Mixed-precision date ranges.
- Making Save transactional. Reporting which PUT failed is in scope; fixing the underlying three-writes-no-rollback design is not.
- Runtime validation of R2 JSON in either app.
