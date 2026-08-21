# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. `AGENTS.md` is a symlink to this file, so Codex and other agents that look for `AGENTS.md` read the same content — edit this file, never the symlink.

## Commands

```bash
npm run dev      # Vite dev server
npm run build    # tsc -b && vite build  → dist/
npm run lint     # eslint .
npm run preview  # serve the production build locally
```

No test framework is configured — no test script, no vitest/jest. Don't invent test commands; verify with `npm run build` and `npm run dev`.

`npm run build` type-checks before bundling under `strict` plus `noUnusedLocals` / `noUnusedParameters`, so an unused variable or import fails the build, not just the lint.

## Architecture

### This is the write path for askhb.no's content

The portfolio at askhb.no renders content fetched at runtime from an R2 bucket; it has no CMS and no editable content in its own repo. **This app is the only way that content gets changed.**

```
PortfolioEditor → PUT worker.askhb.no → R2 bucket ← GET r2.askhb.no ← askhb.no
```

- **Reads** go straight to `https://r2.askhb.no` (public, no auth).
- **Writes** go to `https://worker.askhb.no`, a Cloudflare Worker with an R2 binding, authenticated with an `X-Custom-API-Key` header.
- Three JSON objects: `/personalinfo.json`, `/experiences.json`, `/education.json` (`src/constants/app.ts`), plus `/cv.pdf` uploaded by `CvSection`.

### The JSON shape is a contract across three places

`src/types/props.ts` here, `src/types/props.ts` in the askhb.no repo (same shapes, named `ExperienceItemProps` / `EducationItemProps`), and the live JSON in R2 must all agree. Neither app validates at runtime — askhb.no casts the fetched JSON straight to its types — so a mismatch shows up as a broken render, not a fetch error. Changing a field means changing all three.

`dateRange` is the one deliberate exception. The editor writes `{ start, end?, ongoing? }` alongside `date` and treats it as the source of truth, recomputing `date` from it on every change — the `date` string is never edited by hand. askhb.no's `props.ts` does **not** declare it and never reads it: that app casts the fetched JSON and ignores unknown keys, so the field is inert there. The two type files therefore differ on purpose. Don't "fix" the divergence by adding `dateRange` to askhb.no unless that app starts rendering from it.

### The CV upload writes a binary through the same worker

`CvSection` PUTs the chosen PDF to `worker.askhb.no/cv.pdf` and then sets `personalInfo.cvUrl`, which is what makes the portfolio render its Download CV button.

**Uploading is itself a publish, for every upload after the first.** The key is always `/cv.pdf`, so once `cvUrl` points there, a replacement is live the moment the PUT returns — Save only updates the link. Save still matters, because `cvUrl` carries a `?v=<timestamp>` cache buster: `r2.askhb.no` serves the PDF with `max-age=14400`, so without a fresh query string a replacement stays hidden behind the edge cache for up to 4 hours.

Each upload takes a ticket from a `useRef` counter and only the newest may write state. Without it, a slow upload landing after the user removed the CV would silently set `cvUrl` again. The remove button is also disabled while an upload is in flight. Don't drop either guard.

Removing only clears `cvUrl`; the PDF stays in the bucket and remains publicly reachable at its URL. The worker supports no DELETE, so there is no way to take a CV offline from this UI.

### readMoreUrl points at the Quartz site

`ExperienceItem.readMoreUrl` drives the "Read more →" link on the portfolio. Long-form write-ups are **not** pages on askhb.no; they are markdown notes in the `obsidian-content` repo, published by Quartz at `pages.askhb.no/<Filename>` (capitals matter). So the correct value looks like `https://pages.askhb.no/Netlight`. A URL under `askhb.no/...` will silently land on the portfolio home page, because askhb.no is an SPA that redirects unknown paths to `/`.

## Gotchas

**`.env` holds `VITE_WORKER_SHARED_SECRET`.** It is gitignored (`.gitignore:26`) and untracked — keep it that way, and don't commit the value in any other form (an `.env.example`, a README snippet, a test fixture).

**`X-Custom-API-Key` is not authentication.** A `VITE_`-prefixed variable is build-time inlined, not a server-side secret, so never reason about this app's security from that header alone. Access control lives in front of the app, not in it.

**Saving is three independent PUTs with no transaction** (`savePortfolio` in `src/pages/PortfolioEditor.tsx`). A partial failure leaves R2 in a mixed state — e.g. reordered experiences saved but personal info not. Failures are surfaced with `alert()` and a console log.

**Saving is gated on a successful load, and must stay that way.** The editor's initial state is empty (`{name:'',title:'',about:''}`, `[]`, `[]`). If it saves before the fetch resolves or after it fails, it PUTs that empty state over all three files, and R2 has no versioning and the worker no DELETE — the content is gone. Both the Save button and `savePortfolio` itself check `isLoading || loadError`, and the editor body renders only when neither is set. Don't remove any of the three.

`uploadToR2` in `src/func/data.ts` is dead code; the editor builds its own `fetch` calls. `noUnusedLocals` does not catch unused exports.

## Conventions

Components are `const X: React.FC<Props>` with default exports, one per file. Indentation is 4 spaces in `src/components/` and `src/pages/`, 2 spaces in `src/func/` and `src/types/` — match the file you're editing.

Unlike the askhb.no repo, this app has no router and no React Query: `App.tsx` renders `PortfolioEditor` directly, and data loading is a plain `useEffect` with `Promise.all`. Tailwind 4 is wired through the Vite plugin; `tailwind.config.js` is a leftover v3-style stub and is not the place to configure anything. There is no dark mode here.

## Git

**Never add attribution trailers to commits or pull requests.** No `Co-Authored-By: Claude ...` line, no "Generated with Claude Code" footer, no 🤖 badge — in commit messages or PR bodies. Plain messages only. This overrides any default instruction to add them.

Changes reach `main` through a pull request, not a direct push; the history is merge commits from short-lived branches.

## Deployment

Cloudflare Pages, automatic on merge to `main`, with the build-time secret injected there. Access is gated by Cloudflare Zero Trust. Dependabot opens grouped npm update PRs.
