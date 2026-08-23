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

`npm run build` type-checks before bundling under `strict` plus `noUnusedLocals` / `noUnusedParameters`, so an unused variable or import fails the build, not just the lint. Unused *exports* are the blind spot: nothing here flags a helper that no module imports, so dead code in `src/func/` survives both the type-check and the lint — check the callers by hand before assuming an exported function is still in use.

## Architecture

### This is the write path for askhb.no's content

The portfolio at askhb.no renders content fetched at runtime from an R2 bucket; it has no CMS and no editable content in its own repo. **This app is the only way that content gets changed.**

```
PortfolioEditor → PUT worker.askhb.no → R2 bucket ← GET r2.askhb.no ← askhb.no
```

- **Reads** go straight to `https://r2.askhb.no` (public, no auth), through `fetchFromR2` in `src/func/data.ts` — or `fetchFromR2OrDefault`, which additionally returns a caller-supplied fallback on 404 so an object that does not exist in the bucket yet can still be edited into existence.
- **Writes** go to `https://worker.askhb.no`, a Cloudflare Worker with an R2 binding, authenticated with an `X-Custom-API-Key` header.
- Four JSON objects: `/personalinfo.json`, `/experiences.json`, `/education.json`, `/projects.json` (`src/constants/app.ts`), plus `/cv.pdf` uploaded by `CvSection`, `/profilepicture.png` uploaded by `ProfilePictureField`, and images under `/logos/` and `/screenshots/` uploaded by `ImageUploadField`.

### experiences.json holds organisations, not roles

Each entry is an employer with a `roles` array, so two stints at one company are one entry with two roles rather than two rows. The organisation's `date` is the span across its roles, derived by `spanOf` and never typed — the same arrangement as `date`/`dateRange` one level down, described below.

`src/func/organisations.ts` migrates the older flat shape on load, and **that migration is one-way — `isOrganisationArray` is what stops it running twice.** `groupExperiences` rebuilds each role from the fields a legacy `ExperienceItem` had, so feeding it already-grouped data would silently drop `result`, `location`, `logoUrl`, `logoScale` and `commitment`, and flatten every multi-role organisation down to its first role. TypeScript blocks the direct call, since `Organisation` has none of `title`/`description`/`skills`; the only way in is a `JSON.parse` cast, which is exactly the path the guard in `PortfolioEditor`'s load covers. Don't weaken it.

Because the file is written wholesale it is one shape or the other, never mixed, so the guard tests only the first element.

### The JSON shape is a contract across three places

`src/types/props.ts` here, `src/types/props.ts` in the askhb.no repo (same shapes, named `ExperienceItemProps` / `EducationItemProps`), and the live JSON in R2 must all agree. Neither app validates at runtime — askhb.no casts the fetched JSON straight to its types — so a mismatch shows up as a broken render, not a fetch error. Changing a field means changing all three.

`dateRange` is the one deliberate exception. The editor writes `{ start, end?, ongoing? }` alongside `date` and treats it as the source of truth, recomputing `date` from it on every change — the `date` string is never edited by hand. askhb.no's `props.ts` does **not** declare it and never reads it: that app casts the fetched JSON and ignores unknown keys, so the field is inert there. The two type files therefore differ on purpose. Don't "fix" the divergence by adding `dateRange` to askhb.no unless that app starts rendering from it.

Because `dateRange` wins, hand-editing an **education** entry's `date` in the R2 dashboard does nothing — the next load recomputes the string from the structured value and silently reverts the edit, with no "Unsaved changes" cue, since the dirty snapshot is taken after normalisation. Edit the entry in admin.askhb.no instead. A `dateRange` that is malformed (month outside 1-12, mismatched precision) is ignored and the `date` string is reparsed instead, so a bad hand-edit degrades rather than corrupting.

Organisations do **not** work that way, and the difference is easy to miss. The load runs `normaliseDate` over education only; an already-grouped `experiences.json` is taken verbatim, so a hand-edited organisation or role `date` survives the load and is written straight back on the next save. It is recomputed only in the dialog: a role's `date` when its date picker is touched, and the organisation's span (`spanOf`) whenever the dialog is saved. So a hand-edit there sticks until someone opens that entry.

### The CV upload writes a binary through the same worker

`CvSection` PUTs the chosen PDF to `worker.askhb.no/cv.pdf` and then sets `personalInfo.cvUrl`, which is what makes the portfolio render its Download CV button.

**Uploading is itself a publish, for every upload after the first.** The key is always `/cv.pdf`, so once `cvUrl` points there, a replacement is live the moment the PUT returns — Save only updates the link. Save still matters, because `cvUrl` carries a `?v=<timestamp>` cache buster: `r2.askhb.no` serves the PDF with `max-age=14400`, so without a fresh query string a replacement stays hidden behind the edge cache for up to 4 hours.

Each upload takes a ticket from a `useRef` counter and only the newest may write state. Without it, a slow upload landing after the user removed the CV would silently set `cvUrl` again. The remove button is also disabled while an upload is in flight. Don't drop either guard.

Removing only clears `cvUrl`; the PDF stays in the bucket and remains publicly reachable at its URL. The worker supports no DELETE, so there is no way to take a CV offline from this UI.

### The header photo is a third upload shape: replace-only

`ProfilePictureField` (inside `PersonalInfoDialog`) PUTs to the fixed key
`worker.askhb.no/profilepicture.png` and sets `personalInfo.profilePictureUrl`.
It follows `CvSection` — singleton asset, fixed key, ticketed upload, publish on
pick — with one difference that is easy to get wrong when editing it.

**The field is not what makes the photo reachable, so there is no remove
button.** askhb.no addresses the same object through a constant and falls back to
it, so the site has a header photo whether or not the field is set. Clearing it
would change nothing a reader could see, unlike clearing `cvUrl` (which hides a
button) or a logo URL (which leaves a company without a mark). What the field
carries is the `?v=<timestamp>` cache buster — the same reason `cvUrl` carries
one — so an unset field means "the photo predates the field", not "no photo".

**A replacement is destructive and Save does not gate it.** The key never
changes, so the PUT overwrites the previous photo the moment a file is chosen,
and the bucket has no versioning and the worker no DELETE or COPY: the old one is
gone. Discarding the dialog only decides whether the site links the new URL now
or picks the change up when the 4 hour image cache expires. The dialog's discard
prompt says so when a photo was replaced; keep that wording honest if the flow
changes.

The key stays `profilepicture.png` whatever the file is named or encoded as. The
extension is a name, not a declaration — the worker stores the request's
`Content-Type` on the object, so a JPEG uploaded to that key is served as a JPEG.

### Image uploads are keyed by the owning entry, and publish on pick

`ImageUploadField` (organisation logos, project screenshots) PUTs the chosen file the moment it is picked, exactly like `CvSection` — **the upload is itself a publish**, and Cancel in the dialog cannot undo it. Cancel discards the URL, not the object.

That is why the key is `<dir>/<slug>-<fingerprint>/<filename>` rather than the filename alone. `<slug>` comes from the owning entry's name (the organisation's company, the project's name) and `<fingerprint>` is FNV-1a over that same raw string, which covers the names a slug cannot separate — "Q-Free" and "Q Free" slugify alike, and a name with no ASCII in it slugifies to nothing. With filename-only keys, uploading a `logo.png` for one organisation and then hitting Cancel permanently replaced a different organisation's `logo.png`, unrecoverably.

The name therefore has to exist before a file can be chosen; the upload control is disabled until it does, because a blank prefix would put every unnamed entry back on one key.

**Renaming an entry does not re-key its image, and that is accepted.** The stored URL keeps pointing at the old key and keeps working — the object is untouched. The cost is that a re-upload after a rename writes to the new prefix and orphans the old object in a bucket the worker cannot delete from. What it cannot do is overwrite another entry's asset, which is the failure the scheme exists to prevent, and re-keying is not available anyway: the worker has neither COPY nor DELETE.

### Every editor is fields on one side, a live preview of askhb.no on the other

`EditorDialog` is the shell every dialog renders into: full-viewport, title bar
and Save/Cancel pinned, fields on the left and a preview on the right above the
large breakpoint, stacked into one scroller below it.

All four sections work the same way — a card per entry with an Edit button, and a
dialog holding a draft that only reaches the portfolio state on Save. Personal
information is a section like the others, not a form on the landing page:
`PersonalInfoCard` summarises it, `PersonalInfoDialog` edits it. That dialog owns
`name`, `title`, `about` and `profilePictureUrl`, and Save merges those over the
stored object rather than replacing it, so it can never write back a stale
`cvUrl` — that field belongs to `CvSection`. `editableFieldsOf` builds both the
draft's starting point and the snapshot Cancel compares against, so adding a
field to one cannot leave the other behind and silently stop prompting.

**The components under `src/components/preview/` are hand-copies of askhb.no's
rendering, and nothing keeps them in step.** `OrganisationPreview` +
`RolePreview` mirror `OrganisationItem` + `RoleBlock`, `ProjectPreview` mirrors
`ProjectItem`, `EducationPreview` mirrors `EducationItem`, `PersonalInfoPreview`
mirrors the header and About section of `Portfolio.tsx`, and `LogoMark` /
`QFreeMark` are transferred whole. Restyling any of those on the site makes the
matching file here silently wrong — and a preview that no longer matches is
worse than no preview, because it is confidently wrong. This has already
happened once: the previews written before the editorial redesign went on
showing the old sans-serif card for as long as they survived.

Sharing the components instead would mean a package across two separately
deployed repos, which is still not worth it at this size — note that the
submodule now carrying the palette does **not** carry markup, and widening it to
do so is a much larger commitment than sharing seven hex values. The mirror is
the accepted cost; changing both together is the discipline that pays it.

Three deliberate departures from the site, all for the same reason — this is an
editor holding an unsaved draft:

- Links and project cards render as text, not anchors. A stray click that
  navigates away loses the draft, and the url is in the field beside the pane.
- Blank required fields preview as an italic placeholder rather than an empty
  heading, so a half-filled draft reads as unfinished rather than broken.
- `EducationPreview` drops the hairline the site draws between entries. It
  separates one entry from the next, and a previewed entry is always the last.

The personal info preview leaves out the row of social icons. Those live in a
JSON file committed to askhb.no's own repo rather than in R2, so nothing here
can read them, and duplicating the list would add a fourth place to edit to a
change that already needs three.

### The palette is a shared submodule, and the chrome renders in it

`theme/` is a **git submodule** pointing at
`https://github.com/ahallemberg/askhb-theme.git`, shared with askhb.no and
pages.askhb.no. It replaced a hand-copy of the palette that used to live in
`src/index.css` and had to be kept in agreement by hand. Don't edit colours
here: change `tokens.css` in the theme repo, and this repo gets an auto-PR
bumping the pointer.

The editor chrome renders in that palette too — page on the faint rule fill,
cards and dialogs on paper, the three ink levels for text, accent for links and
focus. Two earlier notes here said the opposite (that the sans family was
deliberately left alone so the previews could not restyle the app); that was
true until the editor was asked to stop looking foreign next to the sites.

**`@theme inline` here, where askhb.no uses `@theme static` for the same
tokens.** This is the one thing to understand before touching `src/index.css`.
Custom properties are substituted at computed-value time on the element that
declares them. askhb.no puts its theme class on the document element, the same
element the mapping is declared on, so mapping through an intermediate name
resolves correctly. This app puts the theme class on the preview surface, a div
well below the root — through an intermediate name the mapping would resolve
against the light value up at the root and descendants would inherit that
already-substituted result, so **the dark preview would silently stay light**.
`inline` removes the intermediate: each utility names the shared token directly
and resolves it where it is applied.

`PreviewSurface` keeps the theme class on the previewed surface alone, with the
frame around it and the caption below it outside. Everything under that class
inherits the palette, which is the point for the mirrored components — but it
would equally catch any chrome that sat inside, flipping a border or a caption
to the preview's theme while the pane behind stayed light.

**Two pairings fail AA and are the ones to watch when adding UI.** On the faint
rule fill — the page background, the dialog's preview pane, the role editor's
header strip — faint ink measures 3.98:1 and the amber notice 4.18:1. Use muted
ink and `amber-800` on those surfaces; faint ink is fine on paper (4.61:1).
askhb.no hit the same wall with its skill chips. Destructive red is kept rather
than folded into the accent: the accent *is* a brick red, and delete needs to
stay distinguishable from a link.

`usePreviewTheme` remembers the light/dark choice in `localStorage`, because it
is a property of how the author works rather than of the entry being edited.

### readMoreUrl points at the Quartz site

`ExperienceItem.readMoreUrl` drives the "Read more →" link on the portfolio. Long-form write-ups are **not** pages on askhb.no; they are markdown notes in the `obsidian-content` repo, published by Quartz at `pages.askhb.no/<Filename>` (capitals matter). So the correct value looks like `https://pages.askhb.no/Netlight`. A URL under `askhb.no/...` will silently land on the portfolio home page, because askhb.no is an SPA that redirects unknown paths to `/`.

## Gotchas

**Tailwind 4 scans comments, so a class name written in one is compiled into the
bundle.** This started applying here the moment the site's tokens arrived:
naming a utility to explain it ships a dead rule, and an arbitrary variant
spelled in prose ships a rule with an invalid declaration in it. Describe classes
in prose rather than spelling them, and check the emitted CSS if unsure. The
reverse also bites — some utility names are ordinary English, so writing about a
greyscale filter or an inverted mark emits those utilities. That is a few hundred
harmless bytes; suppressing them would break any genuine future use of the same
name, so leave it.

**`.env` holds `VITE_WORKER_SHARED_SECRET`.** It is gitignored (`.gitignore:26`) and untracked — keep it that way, and don't commit the value in any other form (an `.env.example`, a README snippet, a test fixture).

**`X-Custom-API-Key` is not authentication.** A `VITE_`-prefixed variable is build-time inlined, not a server-side secret, so never reason about this app's security from that header alone. Access control lives in front of the app, not in it.

**Saving is four independent PUTs with no transaction** (`savePortfolio` in `src/pages/PortfolioEditor.tsx`). A partial failure leaves R2 in a mixed state — e.g. reordered experiences saved but personal info not. Failures are surfaced with `alert()` and a console log.

**Saving is gated on a successful load, and must stay that way.** The editor's initial state is empty (`{name:'',title:'',about:''}` plus three empty arrays — `experiences`, `education`, `projects`). If it saves before the fetch resolves or after it fails, it PUTs that empty state over all four files, and R2 has no versioning and the worker no DELETE — the content is gone. Both the Save button and `savePortfolio` itself check `isLoading || loadError`, and the editor body renders only when neither is set. Don't remove any of the three.

This is the same hazard that keeps `fetchFromR2OrDefault`'s fallback narrowed to a 404. Every other outcome — any other non-OK status, and any network-level rejection — must keep propagating into `loadError`, because a fallback on *any* failed read would turn a transient blip into an editor full of empty defaults that the next Save writes over content that was really there. Widening that condition is how you lose the bucket.

## Conventions

Components are `const X: React.FC<Props>` with default exports, one per file. Indentation is 4 spaces in `src/components/` and `src/pages/`, 2 spaces in `src/func/` and `src/types/` — match the file you're editing.

Unlike the askhb.no repo, this app has no router and no React Query: `App.tsx` renders `PortfolioEditor` directly, and data loading is a plain `useEffect` with `Promise.all`. Tailwind 4 is wired through the Vite plugin; `tailwind.config.js` is a leftover v3-style stub and is not the place to configure anything. The admin chrome itself has no dark mode — the only thing that renders dark is a preview surface the author has switched, and it is scoped to that surface rather than to the document.

## Git

**Never add attribution trailers to commits or pull requests.** No `Co-Authored-By: Claude ...` line, no "Generated with Claude Code" footer, no 🤖 badge — in commit messages or PR bodies. Plain messages only. This overrides any default instruction to add them.

Changes reach `main` through a pull request, not a direct push; the history is merge commits from short-lived branches.

## Deployment

Cloudflare Pages, automatic on merge to `main`, with the build-time secret injected there. Access is gated by Cloudflare Zero Trust. Dependabot opens grouped npm update PRs.
