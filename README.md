# admin.askhb.no

A minimalist portfolio editor that saves data directly to R2 bucket via Cloudflare Worker.

## Architecture

```
Portfolio Editor → worker.askhb.no → R2 Bucket (r2.askhb.no)
```

- **Frontend**: React component with inline editing
- **Backend**: Cloudflare Worker with R2 binding
- **Storage**: Three JSON files in R2 bucket
- **Auth**: Cloudflare Zero Trust
- **Hosting**: Cloudflare Pages

## File Structure

```
r2.askhb.no/
├── personalInfo.json    # Name, title, about
├── experiences.json     # Work experience array
└── education.json       # Education array
```

## Setup

- **Worker endpoint**: `https://worker.askhb.no`
- **Environment variable**: `VITE_WORKER_SHARED_SECRET`
- **Build process**: Cloudflare Pages (auto-deploys with secret injection)
- **Authentication**: Cloudflare Zero Trust

## Data Flow

**Save Process:**
1. Editor sends 3 PUT requests (personalInfo, experiences, education)
2. Worker authenticates and forwards to R2
3. R2 stores each as separate JSON file

**Load Process:**
1. Main portfolio fetches from `r2.askhb.no/*.json`
2. Direct R2 access (no worker needed for reads)