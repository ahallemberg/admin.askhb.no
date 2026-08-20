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

### The CV upload writes a binary through the same worker

`CvSection` PUTs the chosen PDF to `worker.askhb.no/cv.pdf` and then sets `personalInfo.cvUrl`, which is what makes the portfolio render its Download CV button. The upload happens immediately; the `cvUrl` field is only persisted when Save is pressed, so uploading without saving leaves the file in the bucket but no button on the site.

The worker stores the body with `MAIN_BUCKET.put(key, request.body)` and does not pass `httpMetadata`, so the uploaded PDF has no stored content type and R2 serves it as a download rather than rendering it inline. Fixing that means a one-line worker change and a redeploy.

### readMoreUrl points at the Quartz site

`ExperienceItem.readMoreUrl` drives the "Read more →" link on the portfolio. Long-form write-ups are **not** pages on askhb.no; they are markdown notes in the `obsidian-content` repo, published by Quartz at `pages.askhb.no/<Filename>` (capitals matter). So the correct value looks like `https://pages.askhb.no/Netlight`. A URL under `askhb.no/...` will silently land on the portfolio home page, because askhb.no is an SPA that redirects unknown paths to `/`.

## Gotchas

**`.env` holds `VITE_WORKER_SHARED_SECRET`.** It is gitignored (`.gitignore:26`) and untracked — keep it that way, and don't commit the value in any other form (an `.env.example`, a README snippet, a test fixture).

**The "shared secret" is not secret.** `VITE_`-prefixed variables are inlined into the client bundle at build time, so it ships in the public JavaScript of a deployed build. The real access control is Cloudflare Zero Trust in front of the app; treat the header as a speed bump, not authentication.

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
