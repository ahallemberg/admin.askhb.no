import { PAGES_BASE_URL, PAGES_CONTENT_INDEX_URL } from '../constants/app';

interface PublishedPage {
  slug: string;
  title: string;
  url: string;
}

// Quartz emits one entry per note plus an "index" redirect stub per directory.
// Those stubs are navigation, not linkable write-ups.
function isIndexStub(slug: string): boolean {
  return slug === 'index' || slug.endsWith('/index');
}

// Percent-encode each path segment but not the separators, so a nested slug keeps
// its structure. encodeURIComponent on the whole slug would escape the slashes.
function toPageUrl(slug: string): string {
  return `${PAGES_BASE_URL}/${slug.split('/').map(encodeURIComponent).join('/')}`;
}

// This duplicates the four lines of fetchFromR2 rather than reusing it. Not because
// reuse would leak anything — fetchFromR2 is a pure transport helper and carries no
// failure semantics — but because it is named for R2, and calling it against
// pages.askhb.no would mislead a reader more than the copy does.
async function fetchPublishedPages(): Promise<PublishedPage[]> {
  const response = await fetch(PAGES_CONTENT_INDEX_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${PAGES_CONTENT_INDEX_URL}: ${response.status} ${response.statusText}`);
  }

  const index = await response.json() as Record<string, { title?: string }>;

  // An array or a number would otherwise degrade silently into bogus "0" / "1"
  // options, or an empty list with no failure reported. Reject it so the caller's
  // catch runs and the field says it could not load.
  if (index === null || typeof index !== 'object' || Array.isArray(index)) {
    throw new Error(`Unexpected shape from ${PAGES_CONTENT_INDEX_URL}: expected an object`);
  }

  return Object.entries(index)
    .filter(([slug]) => !isIndexStub(slug))
    .map(([slug, entry]) => ({ slug, title: entry?.title || slug, url: toPageUrl(slug) }))
    .sort((a, b) => a.title.localeCompare(b.title, 'en'));
}

export type { PublishedPage };
export { fetchPublishedPages };
