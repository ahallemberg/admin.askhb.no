import { PAGES_BASE_URL, PAGES_CONTENT_INDEX_URL } from '../constants/app';

interface PublishedPage {
  slug: string;
  title: string;
  url: string;
}

// Quartz emits one entry per note plus an "index" redirect stub, which is not a
// linkable write-up.
const EXCLUDED_SLUGS = new Set(['index']);

// Deliberately not fetchFromR2: this is a different origin with a different failure
// meaning. A failure here degrades one field; a failure there must block saving.
async function fetchPublishedPages(): Promise<PublishedPage[]> {
  const response = await fetch(PAGES_CONTENT_INDEX_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${PAGES_CONTENT_INDEX_URL}: ${response.status} ${response.statusText}`);
  }

  const index = await response.json() as Record<string, { title?: string }>;

  return Object.entries(index)
    .filter(([slug]) => !EXCLUDED_SLUGS.has(slug))
    .map(([slug, entry]) => ({ slug, title: entry.title || slug, url: `${PAGES_BASE_URL}/${slug}` }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export type { PublishedPage };
export { fetchPublishedPages };
