# Admin Editor Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin editor's free-text `Date` and `readMoreUrl` fields with structured pickers, show a live preview of each entry, and stop silent loss of unsaved edits.

**Architecture:** Pure logic lives in `src/func/` modules (`dates.ts`, `pages.ts`, `compare.ts`) that hold no React state, so the risky parts — date parsing and formatting — are reviewable and verifiable in isolation. Thin components in `src/components/` consume them. `dateRange` is the source of truth for dates; the `date` string is derived from it on every change and never edited directly.

**Tech Stack:** React 19, TypeScript 6 (`strict`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`), Vite 8, Tailwind 4, lucide-react. No test framework, none being added.

## Global Constraints

- **No test framework exists and none is added.** Verification is `npm run build`, `npm run lint`, and named manual checks. Never invent a test command.
- **`npm run build` type-checks before bundling.** An unused import or variable fails the build, not just the lint.
- **Indentation is 4 spaces in `src/components/` and `src/pages/`, 2 spaces in `src/func/` and `src/types/`.** Match the file being edited.
- **`verbatimModuleSyntax` is on** — type-only imports must be written `import { type Foo } from '...'` or `import type { Foo } from '...'`.
- **Components are `const X: React.FC<Props>` with default exports, one per file.**
- **Never add attribution trailers to commits or PRs.** No `Co-Authored-By`, no "Generated with", no 🤖.
- **Changes reach `main` through a PR, never a direct push.**
- **The three save guards in `PortfolioEditor` are load-bearing and must survive every task:** the Save button's `disabled={isLoading || !!loadError}`, the `if (isLoading || loadError) return;` inside `savePortfolio`, and the `{!isLoading && !loadError && (...)}` conditional around the editor body. R2 has no versioning and the worker has no DELETE — a regression here is unrecoverable.
- **askhb.no is not modified by any task in this plan.**
- Month abbreviations are exactly `Jan. Feb. Mar. Apr. May Jun. Jul. Aug. Sep. Oct. Nov. Dec.` — `May` takes no period. Range separator is `" - "`. Ongoing end renders as the literal `today`.

---

## Task 0: Land the spec and this plan

**Files:**
- Already created: `docs/superpowers/specs/2026-08-21-admin-editor-improvements-design.md`
- Create: `docs/superpowers/plans/2026-08-21-admin-editor-improvements.md` (this file)
- Modify: `.gitignore`

Tasks 1–4 each branch from `main`, so the docs need to land first rather than riding along in a feature branch.

- [ ] **Step 1: Commit the plan onto the existing spec branch**

```bash
cd ~/repos/personal/admin.askhb.no
git add docs/superpowers/plans/2026-08-21-admin-editor-improvements.md
git commit -m "Add implementation plan for admin editor improvements"
```

- [ ] **Step 2: Push and open the docs PR**

```bash
git push -u origin admin-editor-improvements-spec
gh pr create --title "Add design spec and implementation plan for admin editor improvements" \
  --body "Design spec and implementation plan for the four editor improvements: structured dates, published-page picker for readMoreUrl, live entry preview, and an unsaved-changes guard. Docs only — no source changes."
```

- [ ] **Step 3: Merge, then return to main**

```bash
gh pr merge --merge --delete-branch
git checkout main && git pull
```

---

## Task 1: Widen the dialogs and add live previews

**Branch:** `dialog-live-preview`

**Files:**
- Create: `src/components/ExperiencePreview.tsx`
- Create: `src/components/EducationPreview.tsx`
- Modify: `src/components/ExperienceDialog.tsx`
- Modify: `src/components/EducationDialog.tsx`
- Modify: `src/pages/PortfolioEditor.tsx` (the blank-draft identity fix)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `ExperiencePreview` (props `{ experience: ExperienceItem }`) and `EducationPreview` (props `{ education: EducationItem }`), both default exports. Task 2 modifies the date line inside the dialogs, not inside these components.

### Why the `PortfolioEditor` change is in this task

`getDefaultExperience()` and `getDefaultEducation()` are called **inline in the render** (`PortfolioEditor.tsx:299` and `:311`), so they return a fresh object on every render of `PortfolioEditor`. Both dialogs reset their draft on referential inequality:

```tsx
if (experience !== lastExperience) { setLastExperience(experience); setTempItem(experience); }
```

Today nothing re-renders `PortfolioEditor` while a dialog is open, so this is harmless. Task 3 adds a `fetchPublishedPages` call whose promise can resolve **while the Add dialog is open**, which re-renders the parent, hands the dialog a brand-new blank object, and wipes whatever the user has typed. Fixing it here means Tasks 2–4 build on correct behaviour.

- [ ] **Step 1: Branch from main**

```bash
cd ~/repos/personal/admin.askhb.no
git checkout main && git pull
git checkout -b dialog-live-preview
```

- [ ] **Step 2: Stabilise the blank-draft object identity**

In `src/pages/PortfolioEditor.tsx`, change the import on line 1 to include `useMemo`:

```tsx
import { useState, useEffect, useMemo } from 'react';
```

Then, immediately after `getDefaultEducation` (around line 182), add:

```tsx
    // getDefaultExperience/getDefaultEducation return a fresh object each call, and
    // the dialogs reset their draft whenever the identity of this prop changes. Held
    // stable for as long as the dialog stays open, an unrelated re-render of this
    // component (a fetch resolving, say) can no longer wipe a half-typed new entry.
    const blankExperience = useMemo(getDefaultExperience, [experienceDialog.isOpen]);
    const blankEducation = useMemo(getDefaultEducation, [educationDialog.isOpen]);
```

Then replace the two call sites in the JSX. `PortfolioEditor.tsx:299`:

```tsx
                                    : blankExperience
```

and `PortfolioEditor.tsx:311`:

```tsx
                                    : blankEducation
```

Note: `react-hooks/exhaustive-deps` will not complain — `getDefaultExperience` is referenced, not called, and the dependency is deliberate. If eslint does flag it, keep the dependency and do not silence the rule; report it instead.

- [ ] **Step 3: Create `src/components/ExperiencePreview.tsx`**

```tsx
import type { ExperienceItem } from "../types/props";

// Mirrors askhb.no's src/components/ExperienceItem.tsx, minus the FadeIn wrapper
// and its dark: classes (this app has no dark mode). Restyling the portfolio card
// will make this preview stale — update both together.
const ExperiencePreview: React.FC<{ experience: ExperienceItem }> = ({ experience }) => (
    <div>
        <h3 className="text-xl font-semibold">{experience.title || 'Untitled'}</h3>
        <p className="text-gray-600">{experience.company} | {experience.date}</p>
        <p className="mt-2 text-gray-700 whitespace-pre-line">{experience.description}</p>
        {experience.readMoreUrl && (
            <span className="inline-block mt-2 text-blue-600 text-sm">Read more →</span>
        )}
        <div className="mt-2">
            {experience.skills.map((skill, index) => (
                <span
                    key={index}
                    className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2"
                >
                    {skill}
                </span>
            ))}
        </div>
    </div>
);

export default ExperiencePreview;
```

The `Read more →` link is rendered as a `<span>`, not an `<a>`: this is a preview inside a modal and a real link invites a click that would navigate away from unsaved edits.

- [ ] **Step 4: Create `src/components/EducationPreview.tsx`**

```tsx
import type { EducationItem } from "../types/props";

// Mirrors askhb.no's src/components/EducationItem.tsx, minus the FadeIn wrapper
// and its dark: classes (this app has no dark mode). Restyling the portfolio card
// will make this preview stale — update both together.
const EducationPreview: React.FC<{ education: EducationItem }> = ({ education }) => (
    <div>
        <h3 className="text-xl font-semibold">{education.degree || 'Untitled'}</h3>
        <p className="text-gray-600">{education.institution} | {education.date}</p>
        <div className="mt-2 text-gray-700">
            {education.description.map((line, index) => (
                <p key={index} className={index > 0 ? "mt-1" : ""}>{line}</p>
            ))}
        </div>
    </div>
);

export default EducationPreview;
```

- [ ] **Step 5: Restructure `ExperienceDialog` into two columns**

In `src/components/ExperienceDialog.tsx`, add the import beside the existing ones:

```tsx
import ExperiencePreview from "./ExperiencePreview";
```

Change the modal panel's width class from `max-w-2xl` to `max-w-5xl`:

```tsx
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
```

Wrap the existing form body. The current `<div className="p-6 space-y-4">` becomes a two-column grid whose **first** child is the existing fields and whose second is the preview. Replace the opening tag:

```tsx
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
```

Leave every existing field markup untouched inside that new inner `<div>`. Then, immediately before the closing `</div>` that ends the body (the one right before `<div className="flex justify-end gap-3 p-6 border-t ...">`), close the fields column and add the preview column:

```tsx
          </div>

          <div className="lg:sticky lg:top-0 self-start">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Live preview</p>
            <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
              <ExperiencePreview experience={tempItem} />
            </div>
          </div>
        </div>
```

- [ ] **Step 6: Apply the same restructure to `EducationDialog`**

In `src/components/EducationDialog.tsx`, add:

```tsx
import EducationPreview from "./EducationPreview";
```

Change `max-w-2xl` to `max-w-5xl` on the modal panel, open the grid the same way:

```tsx
                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
```

and close it with the preview column before the footer:

```tsx
                    </div>

                    <div className="lg:sticky lg:top-0 self-start">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Live preview</p>
                        <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                            <EducationPreview education={tempItem} />
                        </div>
                    </div>
                </div>
```

- [ ] **Step 7: Build and lint**

```bash
npm run build && npm run lint
```

Expected: both exit 0. A "declared but never read" error means an import was added without being used — fix it rather than deleting the usage.

- [ ] **Step 8: Manual check**

```bash
npm run dev
```

Confirm, in the browser:
1. Opening an existing experience shows the preview on the right with that entry's real values.
2. Typing in Job Title updates the preview heading as you type.
3. Scrolling the left column leaves the preview in place.
4. Clicking "Add Experience", typing a title, then waiting several seconds does **not** clear the field (this is the Step 2 fix; it will be exercised harder in Task 3).
5. Both checks repeated for the Education dialog.

- [ ] **Step 9: Commit and open the PR**

```bash
git add -A
git commit -m "Show a live preview beside the fields in both editor dialogs"
git push -u origin dialog-live-preview
gh pr create --title "Show a live preview beside the fields in both editor dialogs" \
  --body "Widens both dialogs to max-w-5xl and adds a sticky live preview column mirroring the askhb.no card markup.

Also stabilises the identity of the blank draft object passed to each dialog. getDefaultExperience/getDefaultEducation were called inline in render, so any re-render of PortfolioEditor handed the dialog a new object and reset the draft. Nothing triggers that today, but the published-pages fetch in a later PR would."
```

Wait for the Cloudflare Pages preview deploy and click through it before merging.

---

## Task 2: Structured dates

**Branch:** `structured-dates`

**Files:**
- Create: `src/func/dates.ts`
- Create: `src/components/DateRangePicker.tsx`
- Modify: `src/types/props.ts`
- Modify: `src/components/ExperienceDialog.tsx`
- Modify: `src/components/EducationDialog.tsx`
- Modify: `src/pages/PortfolioEditor.tsx` (normalise on load)
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `ExperiencePreview` / `EducationPreview` from Task 1 (unchanged).
- Produces:
  - `DateParts` = `{ year: number; month?: number }`, `DateRange` = `{ start: DateParts; end?: DateParts; ongoing?: boolean }`, both exported from `src/types/props.ts`.
  - `src/func/dates.ts` exports `MONTHS: string[]`, `formatDateRange(range: DateRange): string`, `parseDateString(date: string): DateRange | null`, `yearOptions(): number[]`, `normaliseDate<T extends { date: string; dateRange?: DateRange }>(item: T): T`, plus `PickerState`, `pickerStateFromRange(range: DateRange | undefined): PickerState` and `rangeFromPickerState(state: PickerState): DateRange | null`.
  - `DateRangePicker` with props `{ value: DateRange | undefined; fallbackText: string; onChange: (range: DateRange | null) => void }`, default export.

- [ ] **Step 1: Branch from main**

```bash
cd ~/repos/personal/admin.askhb.no
git checkout main && git pull
git checkout -b structured-dates
```

- [ ] **Step 2: Add the date types**

In `src/types/props.ts` (2-space indent), add above `interface ExperienceItem`:

```ts
interface DateParts {
  year: number;
  month?: number;   // 1-12; absent means year-only precision
}

interface DateRange {
  start: DateParts;
  end?: DateParts;    // absent with ongoing unset means a single date, no end
  ongoing?: boolean;  // renders the end as "today"
}
```

Add `dateRange?: DateRange;` after the `date` field of **both** `ExperienceItem` and `EducationItem`:

```ts
interface ExperienceItem {
  title: string;
  company: string;
  date: string;
  dateRange?: DateRange;
  description: string;
  skills: string[];
  readMoreUrl?: string;
}
```

```ts
interface EducationItem {
  degree: string;
  institution: string;
  date: string;
  dateRange?: DateRange;
  description: string[];
}
```

Extend the export at the bottom:

```ts
export type { PersonalInfo, ExperienceItem, EducationItem, PortfolioData, DragHandleProps, DateParts, DateRange };
```

- [ ] **Step 3: Create `src/func/dates.ts`**

2-space indent, matching the rest of `src/func/`.

```ts
import type { DateParts, DateRange } from '../types/props';

// Month abbreviations exactly as they render on askhb.no. "May" is not an
// abbreviation, so it takes no period.
const MONTHS = [
  'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.',
  'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'
];

const SEPARATOR = ' - ';
const ONGOING_LABEL = 'today';
const ONGOING_WORDS = ['today', 'present', 'now'];

const FIRST_YEAR = 1980;
const YEARS_AHEAD = 10;

function formatParts(parts: DateParts): string {
  return parts.month ? `${MONTHS[parts.month - 1]} ${parts.year}` : String(parts.year);
}

function formatDateRange(range: DateRange): string {
  const start = formatParts(range.start);
  if (range.ongoing) return start + SEPARATOR + ONGOING_LABEL;
  if (!range.end) return start;
  return start + SEPARATOR + formatParts(range.end);
}

// "Apr." / "apr" / "APRIL" all resolve to 4. This case-insensitivity is what
// absorbs the lowercase "aug." / "jun." already live in education.json.
function parseMonth(token: string): number | undefined {
  const cleaned = token.trim().replace(/\.$/, '').toLowerCase();
  if (!cleaned) return undefined;
  const index = MONTHS.findIndex(month => {
    const bare = month.replace(/\.$/, '').toLowerCase();
    return bare === cleaned || cleaned.startsWith(bare);
  });
  return index === -1 ? undefined : index + 1;
}

function parseParts(text: string): DateParts | null {
  const trimmed = text.trim();
  const yearOnly = /^(\d{4})$/.exec(trimmed);
  if (yearOnly) return { year: Number(yearOnly[1]) };

  const monthYear = /^([A-Za-z.]+)\s+(\d{4})$/.exec(trimmed);
  if (!monthYear) return null;
  const month = parseMonth(monthYear[1]);
  if (!month) return null;
  return { year: Number(monthYear[2]), month };
}

// Returns null for anything it does not fully understand. Callers must leave the
// original string alone in that case rather than writing a guess.
function parseDateString(date: string): DateRange | null {
  const trimmed = date.trim();
  if (!trimmed) return null;

  const segments = trimmed.split('-');
  if (segments.length > 2) return null;

  const start = parseParts(segments[0]);
  if (!start) return null;

  if (segments.length === 1) return { start };

  const endText = segments[1].trim();
  if (ONGOING_WORDS.includes(endText.toLowerCase())) return { start, ongoing: true };

  const end = parseParts(endText);
  if (!end) return null;

  // Mixed precision ("2019 - Sep. 2023") is deliberately unsupported.
  if ((start.month === undefined) !== (end.month === undefined)) return null;

  return { start, end };
}

function yearOptions(): number[] {
  const last = new Date().getFullYear() + YEARS_AHEAD;
  const years: number[] = [];
  for (let year = last; year >= FIRST_YEAR; year--) years.push(year);
  return years;
}

// Fills in dateRange and rewrites date into the canonical format. An entry whose
// date cannot be parsed is returned untouched, so nothing is ever destroyed by a
// parser gap.
function normaliseDate<T extends { date: string; dateRange?: DateRange }>(item: T): T {
  const range = item.dateRange ?? parseDateString(item.date);
  if (!range) return item;
  return { ...item, dateRange: range, date: formatDateRange(range) };
}

type EndMode = 'date' | 'ongoing' | 'none';

// The picker's raw select values. Every field is a string because an unset
// <select> is the empty string, and a partially filled picker is a legal state.
interface PickerState {
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
  endMode: EndMode;
  yearOnly: boolean;
}

const EMPTY_PICKER_STATE: PickerState = {
  startYear: '', startMonth: '', endYear: '', endMonth: '', endMode: 'date', yearOnly: false
};

function pickerStateFromRange(range: DateRange | undefined): PickerState {
  if (!range) return EMPTY_PICKER_STATE;
  const endMode: EndMode = range.ongoing ? 'ongoing' : range.end ? 'date' : 'none';
  return {
    startYear: String(range.start.year),
    startMonth: range.start.month ? String(range.start.month) : '',
    endYear: range.end ? String(range.end.year) : '',
    endMonth: range.end?.month ? String(range.end.month) : '',
    endMode,
    yearOnly: range.start.month === undefined
  };
}

// Returns null while the picker is incomplete. Callers treat null as "leave the
// existing date alone", never as "clear it".
function rangeFromPickerState(state: PickerState): DateRange | null {
  if (!state.startYear) return null;
  if (!state.yearOnly && !state.startMonth) return null;

  const start: DateParts = state.yearOnly
    ? { year: Number(state.startYear) }
    : { year: Number(state.startYear), month: Number(state.startMonth) };

  if (state.endMode === 'ongoing') return { start, ongoing: true };
  if (state.endMode === 'none') return { start };

  if (!state.endYear) return null;
  if (!state.yearOnly && !state.endMonth) return null;

  const end: DateParts = state.yearOnly
    ? { year: Number(state.endYear) }
    : { year: Number(state.endYear), month: Number(state.endMonth) };

  return { start, end };
}

export type { PickerState };
export {
  MONTHS,
  formatDateRange,
  parseDateString,
  yearOptions,
  normaliseDate,
  pickerStateFromRange,
  rangeFromPickerState
};
```

- [ ] **Step 4: Verify the parser against the real live data**

This is the highest-risk code in the plan — a parser bug would rewrite every date in the bucket on the first Save. Verify it against the actual live strings before wiring it into anything.

Write `/private/tmp/claude-501/-Users-ahallemberg-repos-personal-askhb-no/440e86fa-6272-44d6-bb06-af10ec6336c1/scratchpad/check-dates.mjs`:

```js
// Throwaway verification, not a committed test — this repo has no test framework.
const MONTHS = ['Jan.','Feb.','Mar.','Apr.','May','Jun.','Jul.','Aug.','Sep.','Oct.','Nov.','Dec.'];
// Paste the bodies of parseDateString/parseParts/parseMonth/formatDateRange/formatParts
// from src/func/dates.ts here, with the `import type` line removed.

const live = [
  'Jun. 2026 - Aug. 2026', 'Apr. 2024 - Sep. 2025', 'Jun. 2025 - Jul. 2025',
  'Sep. 2024 - Dec. 2024', 'Sep. 2023 - Sep. 2024', 'Jun. 2024 - Aug. 2024',
  '2019 - 2023', 'Sep. 2026 - aug. 2027', 'Aug. 2023 - jun. 2028', 'Aug. 2020 - jun. 2023',
  'Apr. 2024 - today', 'Jun. 2025', 'May 2024 - May 2025', 'not a date at all'
];
for (const input of live) {
  const parsed = parseDateString(input);
  console.log(`${JSON.stringify(input).padEnd(26)} -> ${parsed ? JSON.stringify(formatDateRange(parsed)) : 'null (left untouched)'}`);
}
```

Run: `node <that path>`

Expected output — every real entry round-trips, the two lowercase ones get fixed, and the garbage string returns null:

```
"Jun. 2026 - Aug. 2026"    -> "Jun. 2026 - Aug. 2026"
"Apr. 2024 - Sep. 2025"    -> "Apr. 2024 - Sep. 2025"
"2019 - 2023"              -> "2019 - 2023"
"Sep. 2026 - aug. 2027"    -> "Sep. 2026 - Aug. 2027"
"Aug. 2023 - jun. 2028"    -> "Aug. 2023 - Jun. 2028"
"Aug. 2020 - jun. 2023"    -> "Aug. 2020 - Jun. 2023"
"Apr. 2024 - today"        -> "Apr. 2024 - today"
"Jun. 2025"                -> "Jun. 2025"
"May 2024 - May 2025"      -> "May 2024 - May 2025"
"not a date at all"        -> null (left untouched)
```

Do not proceed until this output matches. If any real entry does not round-trip, fix `dates.ts` first.

- [ ] **Step 5: Create `src/components/DateRangePicker.tsx`**

4-space indent, matching the rest of `src/components/`.

```tsx
import { useState } from "react";
import type { DateRange } from "../types/props";
import { MONTHS, yearOptions, pickerStateFromRange, rangeFromPickerState, type PickerState } from "../func/dates";

const SELECT_CLASS = "p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors disabled:bg-gray-100 disabled:text-gray-400";

const DateRangePicker: React.FC<{
    value: DateRange | undefined;
    fallbackText: string;
    onChange: (range: DateRange | null) => void;
}> = ({ value, fallbackText, onChange }) => {
    const [state, setState] = useState<PickerState>(() => pickerStateFromRange(value));

    // Re-sync when the dialog is handed a different entry.
    const [lastValue, setLastValue] = useState(value);
    if (value !== lastValue) {
        setLastValue(value);
        setState(pickerStateFromRange(value));
    }

    const update = (patch: Partial<PickerState>) => {
        const next = { ...state, ...patch };
        setState(next);
        onChange(rangeFromPickerState(next));
    };

    const years = yearOptions();
    const endDisabled = state.endMode !== 'date';
    // Shown when an existing date string could not be parsed, so the user can see
    // what is currently stored before replacing it.
    const unparsed = !value && fallbackText.trim() !== '';

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <span className="block text-xs text-gray-500 mb-1">Start</span>
                    <div className="flex gap-2">
                        <select
                            value={state.startMonth}
                            disabled={state.yearOnly}
                            onChange={(e) => update({ startMonth: e.target.value })}
                            className={SELECT_CLASS + " flex-1"}
                        >
                            <option value="">Month</option>
                            {MONTHS.map((month, index) => (
                                <option key={month} value={index + 1}>{month}</option>
                            ))}
                        </select>
                        <select
                            value={state.startYear}
                            onChange={(e) => update({ startYear: e.target.value })}
                            className={SELECT_CLASS + " flex-1"}
                        >
                            <option value="">Year</option>
                            {years.map(year => <option key={year} value={year}>{year}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <span className="block text-xs text-gray-500 mb-1">End</span>
                    <div className="flex gap-2">
                        <select
                            value={state.endMonth}
                            disabled={endDisabled || state.yearOnly}
                            onChange={(e) => update({ endMonth: e.target.value })}
                            className={SELECT_CLASS + " flex-1"}
                        >
                            <option value="">Month</option>
                            {MONTHS.map((month, index) => (
                                <option key={month} value={index + 1}>{month}</option>
                            ))}
                        </select>
                        <select
                            value={state.endYear}
                            disabled={endDisabled}
                            onChange={(e) => update({ endYear: e.target.value })}
                            className={SELECT_CLASS + " flex-1"}
                        >
                            <option value="">Year</option>
                            {years.map(year => <option key={year} value={year}>{year}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3">
                <select
                    value={state.endMode}
                    onChange={(e) => update({ endMode: e.target.value as PickerState['endMode'] })}
                    className={SELECT_CLASS + " py-2"}
                >
                    <option value="date">Has an end date</option>
                    <option value="ongoing">Ongoing (today)</option>
                    <option value="none">No end date</option>
                </select>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                        type="checkbox"
                        checked={state.yearOnly}
                        onChange={(e) => update({ yearOnly: e.target.checked, startMonth: '', endMonth: '' })}
                    />
                    Year only
                </label>
            </div>

            {unparsed && (
                <p className="mt-2 text-sm text-amber-700">
                    Stored as “{fallbackText}”, which could not be read as a date. It stays as-is until you pick one above.
                </p>
            )}
        </div>
    );
};

export default DateRangePicker;
```

- [ ] **Step 6: Wire the picker into `ExperienceDialog`**

Replace the entire Date `<div>` block in `src/components/ExperienceDialog.tsx` (the one containing the `placeholder="e.g., Apr. 2024 - today"` input) with:

```tsx
          <DateRangePicker
            value={tempItem.dateRange}
            fallbackText={tempItem.date}
            onChange={handleDateChange}
          />
```

Add the imports:

```tsx
import DateRangePicker from "./DateRangePicker";
import { formatDateRange } from "../func/dates";
```

and add the handler beside `addSkill`:

```tsx
    // dateRange is the source of truth; `date` is derived from it so the two cannot
    // disagree. A null range means the picker is still incomplete — leave the
    // existing date alone rather than clearing it.
    const handleDateChange = (range: DateRange | null) => {
        if (!range) return;
        setTempItem(prev => ({ ...prev, dateRange: range, date: formatDateRange(range) }));
    };
```

Extend the existing type import to carry `DateRange`:

```tsx
import type { ExperienceItem, DateRange } from "../types/props";
```

- [ ] **Step 7: Wire the picker into `EducationDialog`**

Identical change in `src/components/EducationDialog.tsx`. Add:

```tsx
import DateRangePicker from "./DateRangePicker";
import { formatDateRange } from "../func/dates";
import type { EducationItem, DateRange } from "../types/props";
```

(replacing the existing `import type { EducationItem }` line), add the handler beside `addDescription`:

```tsx
    // dateRange is the source of truth; `date` is derived from it so the two cannot
    // disagree. A null range means the picker is still incomplete — leave the
    // existing date alone rather than clearing it.
    const handleDateChange = (range: DateRange | null) => {
        if (!range) return;
        setTempItem(prev => ({ ...prev, dateRange: range, date: formatDateRange(range) }));
    };
```

and replace the Date `<div>` block (the one with `placeholder="e.g., Aug. 2023 - today"`) with:

```tsx
                    <DateRangePicker
                        value={tempItem.dateRange}
                        fallbackText={tempItem.date}
                        onChange={handleDateChange}
                    />
```

- [ ] **Step 8: Normalise on load in `PortfolioEditor`**

This is what makes one Save fix the whole bucket, and it must happen **before** the state is set so the Task 4 dirty snapshot is taken against normalised data — otherwise the editor would report "Unsaved changes" the instant it loads.

Add the import:

```tsx
import { normaliseDate } from '../func/dates';
```

In `loadPortfolioData`, replace the `setPortfolio({ ... })` call (lines 47-51) with:

```tsx
                // Backfill dateRange and canonicalise the date string for every entry.
                // Entries whose date cannot be parsed come back untouched.
                setPortfolio({
                    personalInfo,
                    experiences: experiences.map(normaliseDate),
                    education: education.map(normaliseDate)
                });
```

- [ ] **Step 9: Document the contract change in `CLAUDE.md`**

In the "The JSON shape is a contract across three places" section, append:

```markdown
`dateRange` is the one deliberate exception. The editor writes `{ start, end?, ongoing? }` alongside `date` and treats it as the source of truth, recomputing `date` from it on every change. askhb.no's `props.ts` does **not** declare it and never reads it — it casts the fetched JSON and ignores unknown keys, so the field is inert there. The two type files therefore differ on purpose; do not "fix" the divergence by adding `dateRange` to askhb.no unless that app starts rendering from it.
```

- [ ] **Step 10: Build and lint**

```bash
npm run build && npm run lint
```

Expected: both exit 0.

- [ ] **Step 11: Manual check**

```bash
npm run dev
```

1. Open the Computas experience — the picker shows `Apr.` `2024` → `Sep.` `2025` and the preview reads `Computas - Oslo | Apr. 2024 - Sep. 2025`.
2. Open the Self Employed experience — `Year only` is ticked, months are disabled, preview reads `2019 - 2023`.
3. Open each education entry — the lowercase second months now display capitalised in the preview.
4. Set End to `Ongoing` — end selects disable and the preview ends in `- today`.
5. Set End to `No end date` — the preview shows only the start.
6. Tick `Year only` on a month+year entry — both months blank and disable, preview drops to years.
7. Change something, save the dialog, reopen it — the values persist.
8. **Do not click Save Portfolio yet.**

- [ ] **Step 12: Commit and open the PR**

```bash
git add -A
git commit -m "Replace the free-text date fields with month/year pickers"
git push -u origin structured-dates
gh pr create --title "Replace the free-text date fields with month/year pickers" \
  --body "Adds an optional dateRange field alongside the existing date string. dateRange is the source of truth; date is derived from it on every change and is no longer editable by hand.

Supports four shapes: month+year range, ongoing (\"- today\"), start with no end, and year-only. Mixed precision is deliberately unsupported.

Entries are normalised on load, so the first Save backfills dateRange everywhere and canonicalises the date strings — including the lowercase \"aug.\"/\"jun.\" already live in education.json. An entry whose date cannot be parsed is left untouched.

askhb.no is not changed and needs no deploy; it ignores the new field."
```

**Before merging**, note that the first Save Portfolio after this merges rewrites every entry's date. Click through the Cloudflare preview and confirm all 10 dates read correctly there first.

---

## Task 3: readMoreUrl page picker

**Branch:** `read-more-page-picker`

**Files:**
- Create: `src/func/pages.ts`
- Create: `src/components/ReadMoreUrlSelect.tsx`
- Modify: `src/constants/app.ts`
- Modify: `src/components/ExperienceDialog.tsx`
- Modify: `src/pages/PortfolioEditor.tsx`

**Interfaces:**
- Consumes: the stable `blankExperience` identity from Task 1 — without it this task's fetch wipes half-typed entries.
- Produces: `PublishedPage` = `{ slug: string; title: string; url: string }` and `fetchPublishedPages(): Promise<PublishedPage[]>` from `src/func/pages.ts`; `ReadMoreUrlSelect` with props `{ value: string | undefined; pages: PublishedPage[]; loadFailed: boolean; onChange: (url: string | undefined) => void }`.

Education has no `readMoreUrl`, so only the Experience dialog changes.

- [ ] **Step 1: Branch from main**

```bash
cd ~/repos/personal/admin.askhb.no
git checkout main && git pull
git checkout -b read-more-page-picker
```

- [ ] **Step 2: Add the constants**

In `src/constants/app.ts`, add beside the existing endpoints:

```ts
const PAGES_BASE_URL = "https://pages.askhb.no"
const PAGES_CONTENT_INDEX_URL = PAGES_BASE_URL + "/static/contentIndex.json"
```

and extend the export:

```ts
export { R2_GET_ENDPOINT, EDUCATION_PATH, EXPERIENCE_PATH, PERSONAL_INFO_PATH, CV_PATH, R2_PUT_ENDPOINT, PAGES_BASE_URL, PAGES_CONTENT_INDEX_URL }
```

- [ ] **Step 3: Create `src/func/pages.ts`**

2-space indent.

```ts
import { PAGES_BASE_URL, PAGES_CONTENT_INDEX_URL } from '../constants/app';

interface PublishedPage {
  slug: string;
  title: string;
  url: string;
}

// Quartz emits one entry per note plus an "index" redirect stub, which is not a
// linkable write-up.
const EXCLUDED_SLUGS = new Set(['index']);

// Deliberately not fetchFromR2: this is a different origin with a different
// failure meaning. A failure here degrades one field; a failure there blocks saving.
async function fetchPublishedPages(): Promise<PublishedPage[]> {
  const response = await fetch(PAGES_CONTENT_INDEX_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${PAGES_CONTENT_INDEX_URL}: ${response.status}`);
  }

  const index = await response.json() as Record<string, { title?: string }>;

  return Object.entries(index)
    .filter(([slug]) => !EXCLUDED_SLUGS.has(slug))
    .map(([slug, entry]) => ({ slug, title: entry.title || slug, url: `${PAGES_BASE_URL}/${slug}` }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export type { PublishedPage };
export { fetchPublishedPages };
```

- [ ] **Step 4: Create `src/components/ReadMoreUrlSelect.tsx`**

4-space indent.

```tsx
import type { PublishedPage } from "../func/pages";

const SELECT_CLASS = "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors disabled:bg-gray-100 disabled:text-gray-500";

const ReadMoreUrlSelect: React.FC<{
    value: string | undefined;
    pages: PublishedPage[];
    loadFailed: boolean;
    onChange: (url: string | undefined) => void;
}> = ({ value, pages, loadFailed, onChange }) => {
    // A stored URL the index does not know about: a renamed or unpublished page, or
    // a legacy askhb.no/... link. It is offered as a selectable option so that
    // opening and saving an entry cannot silently clear a working link.
    const isKnown = !value || pages.some(page => page.url === value);

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Read More URL (optional)</label>
            <select
                value={value ?? ''}
                disabled={loadFailed}
                onChange={(e) => onChange(e.target.value || undefined)}
                className={SELECT_CLASS}
            >
                <option value="">None</option>
                {!isKnown && <option value={value}>⚠ Not found: {value}</option>}
                {pages.map(page => (
                    <option key={page.slug} value={page.url}>{page.title}</option>
                ))}
            </select>

            {loadFailed && (
                <p className="mt-2 text-sm text-amber-700">
                    Could not load the published pages from pages.askhb.no, so this field is locked to its current value.
                </p>
            )}
            {!loadFailed && !isKnown && (
                <p className="mt-2 text-sm text-amber-700">
                    This URL is not a published page. Pick one from the list, or leave it if the page is not published yet.
                </p>
            )}
        </div>
    );
};

export default ReadMoreUrlSelect;
```

- [ ] **Step 5: Fetch the pages in `PortfolioEditor`**

Add the imports:

```tsx
import { fetchPublishedPages, type PublishedPage } from '../func/pages';
```

Add state beside `loadError`:

```tsx
    // Deliberately separate from isLoading/loadError. Save is gated on those, and a
    // pages.askhb.no outage must not be able to block saving the portfolio.
    const [publishedPages, setPublishedPages] = useState<PublishedPage[]>([]);
    const [pagesLoadFailed, setPagesLoadFailed] = useState(false);
```

Add a second effect after the existing one:

```tsx
    useEffect(() => {
        fetchPublishedPages()
            .then(setPublishedPages)
            .catch(error => {
                console.error('Error loading published pages:', error);
                setPagesLoadFailed(true);
            });
    }, []);
```

Pass both into the Experience dialog:

```tsx
                            publishedPages={publishedPages}
                            pagesLoadFailed={pagesLoadFailed}
```

- [ ] **Step 6: Use the select in `ExperienceDialog`**

Add the imports:

```tsx
import ReadMoreUrlSelect from "./ReadMoreUrlSelect";
import type { PublishedPage } from "../func/pages";
```

Extend the component's props:

```tsx
const ExperienceDialog: React.FC<{
    experience: ExperienceItem;
    isOpen: boolean;
    isEditing: boolean;
    publishedPages: PublishedPage[];
    pagesLoadFailed: boolean;
    onClose: () => void;
    onSave: (experience: ExperienceItem) => void;
}> = ({ experience, isOpen, isEditing, publishedPages, pagesLoadFailed, onClose, onSave }) => {
```

Replace the whole Read More URL `<div>` (the one with `type="url"`) with:

```tsx
          <ReadMoreUrlSelect
            value={tempItem.readMoreUrl}
            pages={publishedPages}
            loadFailed={pagesLoadFailed}
            onChange={(url) => setTempItem(prev => ({ ...prev, readMoreUrl: url }))}
          />
```

- [ ] **Step 7: Build and lint**

```bash
npm run build && npm run lint
```

Expected: both exit 0.

- [ ] **Step 8: Manual check**

```bash
npm run dev
```

1. Open the Netlight experience — the dropdown shows `Netlight` selected.
2. Open the Q-Free experience — it shows `None`, and the list offers all 7 pages (`Ascend NTNU`, `Ascend NTNU - Deputy Chief Engineer`, `Ascend NTNU - Perception Engineer`, `Computas`, `Netlight`, `Q-Free`, `Web Development`) with no `Redirecting...` / `index` entry.
3. Pick `Q-Free` — the preview's `Read more →` appears.
4. In DevTools, block `pages.askhb.no` and reload: the select is disabled, shows the current value, and the amber note appears. Confirm **Save Portfolio is still enabled**.
5. Click "Add Experience", type a title immediately on page load while the pages fetch is still in flight, and confirm the title is **not** wiped when it resolves (this is the Task 1 fix doing its job).

- [ ] **Step 9: Commit and open the PR**

```bash
git add -A
git commit -m "Pick the Read more link from the published Quartz pages"
git push -u origin read-more-page-picker
gh pr create --title "Pick the Read more link from the published Quartz pages" \
  --body "Replaces the free-text Read More URL input with a select populated from pages.askhb.no/static/contentIndex.json, which makes the askhb.no/... mistake unreachable.

The fetch is deliberately outside the load gate: Save is gated on the three R2 fetches, and a pages.askhb.no outage must not be able to block saving.

A stored URL missing from the index is offered as a selectable '⚠ Not found' option rather than falling back to None, so opening and saving an entry cannot silently clear a working link. If the fetch fails the select locks to its current value."
```

---

## Task 4: Unsaved-changes guard

**Branch:** `unsaved-changes-guard`

**Files:**
- Create: `src/func/compare.ts`
- Modify: `src/components/ExperienceDialog.tsx`
- Modify: `src/components/EducationDialog.tsx`
- Modify: `src/pages/PortfolioEditor.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces: `deepEqual(a: unknown, b: unknown): boolean` from `src/func/compare.ts`.

- [ ] **Step 1: Branch from main**

```bash
cd ~/repos/personal/admin.askhb.no
git checkout main && git pull
git checkout -b unsaved-changes-guard
```

- [ ] **Step 2: Create `src/func/compare.ts`**

2-space indent.

```ts
// Treats an absent key and an explicit `undefined` as equal. The dialogs set
// readMoreUrl to undefined rather than deleting it, so a JSON.stringify comparison
// would report a change where there is none.
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const objectA = a as Record<string, unknown>;
  const objectB = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(objectA), ...Object.keys(objectB)]);

  for (const key of keys) {
    if (!deepEqual(objectA[key], objectB[key])) return false;
  }
  return true;
}

export { deepEqual };
```

- [ ] **Step 3: Confirm the dialog on close in `ExperienceDialog`**

Add the import:

```tsx
import { deepEqual } from "../func/compare";
```

Add above the `if (!isOpen) return null;` line:

```tsx
    // Closing discards the draft outright, so confirm first when there is one.
    const handleClose = () => {
        if (!deepEqual(tempItem, experience) && !window.confirm('Discard changes to this entry?')) {
            return;
        }
        onClose();
    };
```

Replace **both** `onClick={onClose}` occurrences (the ✕ button in the header and the Cancel button in the footer) with `onClick={handleClose}`.

- [ ] **Step 4: Apply the same to `EducationDialog`**

Add the import:

```tsx
import { deepEqual } from "../func/compare";
```

Add above `if (!isOpen) return null;`:

```tsx
    // Closing discards the draft outright, so confirm first when there is one.
    const handleClose = () => {
        if (!deepEqual(tempItem, education) && !window.confirm('Discard changes to this entry?')) {
            return;
        }
        onClose();
    };
```

Replace both `onClick={onClose}` occurrences with `onClick={handleClose}`.

- [ ] **Step 5: Track dirty state in `PortfolioEditor`**

Add `useRef` to the React import:

```tsx
import { useState, useEffect, useMemo, useRef } from 'react';
```

Add the import:

```tsx
import { deepEqual } from '../func/compare';
```

Add beside the other state:

```tsx
    // Snapshot of what is known to be in R2. Set after a successful load and after a
    // fully successful save; anything else on screen means unsaved changes.
    const savedSnapshot = useRef<PortfolioData | null>(null);
```

In `loadPortfolioData`, replace the normalising `setPortfolio({...})` from Task 2 with a version that records the snapshot:

```tsx
                // Backfill dateRange and canonicalise the date string for every entry.
                // Entries whose date cannot be parsed come back untouched.
                const loaded: PortfolioData = {
                    personalInfo,
                    experiences: experiences.map(normaliseDate),
                    education: education.map(normaliseDate)
                };

                // Snapshot the normalised form, not the raw fetch: otherwise the editor
                // would report unsaved changes the instant it finished loading.
                savedSnapshot.current = loaded;
                setPortfolio(loaded);
```

Add the derived flag after the handlers:

```tsx
    const isDirty = savedSnapshot.current !== null && !deepEqual(portfolio, savedSnapshot.current);
```

- [ ] **Step 6: Warn on tab close**

Add after the pages effect:

```tsx
    useEffect(() => {
        if (!isDirty) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [isDirty]);
```

- [ ] **Step 7: Report which files failed, and clear the snapshot only on full success**

Replace the response-handling block of `savePortfolio` (currently lines 151-161) with:

```tsx
            const targets = [
                { name: 'personalinfo.json', request: saveRequests[0] },
                { name: 'experiences.json', request: saveRequests[1] },
                { name: 'education.json', request: saveRequests[2] }
            ];

            const responses = await Promise.all(saveRequests);
            const failed = targets.filter((_, index) => !responses[index].ok);

            if (failed.length === 0) {
                // Only now does the on-screen state match R2.
                savedSnapshot.current = portfolio;
                setSaveTick(tick => tick + 1);
                alert('Portfolio saved successfully!');
                console.log('All files saved successfully');
            } else {
                // The three PUTs are independent with no rollback, so a partial failure
                // leaves R2 in a mixed state. Name the files so it is recoverable.
                const names = failed.map(target => target.name).join(', ');
                alert(`Failed to save: ${names}. R2 is now in a mixed state — fix the problem and save again.`);
                console.error('Some saves failed:', names, responses);
            }
```

`savedSnapshot` is a ref, so assigning it does not re-render and the dirty indicator would not clear on its own. Add a counter beside the other state to force the re-render:

```tsx
    // savedSnapshot is a ref, so bump this to re-render after a successful save.
    const [, setSaveTick] = useState(0);
```

- [ ] **Step 8: Show the indicator**

In the header, replace the Save button's wrapper so the marker sits beside it. Change:

```tsx
                        <button
                            onClick={savePortfolio}
                            disabled={isLoading || !!loadError}
```

to:

```tsx
                        <div className="flex items-center gap-4">
                            {isDirty && (
                                <span className="text-sm text-amber-700">Unsaved changes</span>
                            )}
                            <button
                            onClick={savePortfolio}
                            disabled={isLoading || !!loadError}
```

and close the new wrapper after the button's `</button>`:

```tsx
                            </button>
                        </div>
```

- [ ] **Step 9: Build and lint**

```bash
npm run build && npm run lint
```

Expected: both exit 0. Confirm by reading the file that all three save guards are still present: `disabled={isLoading || !!loadError}` on the button, `if (isLoading || loadError) return;` at the top of `savePortfolio`, and `{!isLoading && !loadError && (` around the editor body.

- [ ] **Step 10: Manual check**

```bash
npm run dev
```

1. Load the page — **no** "Unsaved changes" marker appears (this proves the snapshot was taken post-normalisation).
2. Edit an entry and save the dialog — the marker appears.
3. Try to close the tab — the browser asks to confirm.
4. Open a dialog, type in a field, hit ✕ — a confirm appears; Cancel keeps the dialog open, OK discards.
5. Open a dialog and hit ✕ **without** typing — no confirm.
6. Reorder entries by dragging — the marker appears.

- [ ] **Step 11: Commit and open the PR**

```bash
git add -A
git commit -m "Warn before discarding unsaved edits"
git push -u origin unsaved-changes-guard
gh pr create --title "Warn before discarding unsaved edits" \
  --body "Four guards against silent loss of edits:

- Closing a dialog with a modified draft confirms first.
- A beforeunload handler, registered only while dirty, warns on tab close.
- An 'Unsaved changes' marker sits beside Save.
- savePortfolio now names which of the three PUTs failed and keeps the editor dirty unless all three succeed.

Dirty state compares against a snapshot taken after load-time date normalisation, so a freshly loaded editor is not reported as dirty. deepEqual treats an absent key and an explicit undefined as equal, which JSON.stringify comparison would not."
```

---

## Self-review notes

Checked against the spec:

- Spec §"Feature 1 — Date pickers" → Task 2 Steps 2-7. Covered, including the unparseable-date fallback and the year-only mixed-precision rule.
- Spec §"Feature 2 — readMoreUrl dropdown" → Task 3. Covered, including both no-data-loss cases and the load-gate separation.
- Spec §"Feature 3 — Live preview" → Task 1. Covered.
- Spec §"Feature 4 — Unsaved-changes guard" → Task 4. All four parts covered.
- Spec §"Migration consequence" → Task 2 Step 8 (normalise on load) plus the Task 2 Step 12 warning. The spec asserted every entry is migrated on the first Save; that is only true with load-time normalisation, which this plan makes an explicit step.
- Spec §"File inventory" → every listed file appears in a task. `.gitignore` was already handled when the spec was committed.
- **Not in the spec, added here:** the blank-draft identity fix (Task 1 Step 2). It is a pre-existing latent bug that Task 3 would activate; leaving it out would ship a regression.
- **Not in the spec, added here:** the `setSaveTick` re-render nudge (Task 4 Step 7), needed because `savedSnapshot` is a ref.

Type consistency: `DateRange` / `DateParts` are defined once in Task 2 Step 2 and referenced with those exact names in Steps 3, 5, 6, 7. `PickerState` is defined and exported in Step 3 and imported in Step 5. `PublishedPage` is defined in Task 3 Step 3 and imported in Steps 4 and 5. `deepEqual` is defined in Task 4 Step 2 and imported in Steps 3, 4, 5.
