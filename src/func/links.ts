import type { PortfolioLink } from '../types/props';

const DEFAULT_LABEL = 'Read more';

function isUsableLink(link: PortfolioLink | undefined): boolean {
  return !!link && typeof link.url === 'string' && link.url.trim() !== '';
}

// The label is what askhb.no renders, so an empty one would produce an anchor with
// no text. Fall back rather than dropping the link.
function tidy(link: PortfolioLink): PortfolioLink {
  const label = typeof link.label === 'string' && link.label.trim() !== '' ? link.label.trim() : DEFAULT_LABEL;
  return { label, url: link.url.trim() };
}

// readMoreUrl stays the source of truth for any askhb.no build that predates links,
// so it is derived from the first link rather than edited separately — the same
// arrangement as date/dateRange.
function deriveReadMoreUrl(links: PortfolioLink[]): string | undefined {
  return links.length > 0 ? links[0].url : undefined;
}

// Backfills links from a lone readMoreUrl and keeps the two in step. An entry with
// neither is returned untouched, so nothing gains an empty array it never had.
function normaliseLinks<T extends { readMoreUrl?: string; links?: PortfolioLink[] }>(item: T): T {
  const stored = Array.isArray(item.links) ? item.links.filter(isUsableLink).map(tidy) : [];

  if (stored.length > 0) {
    return { ...item, links: stored, readMoreUrl: deriveReadMoreUrl(stored) };
  }

  if (item.readMoreUrl && item.readMoreUrl.trim() !== '') {
    const links = [{ label: DEFAULT_LABEL, url: item.readMoreUrl.trim() }];
    return { ...item, links, readMoreUrl: deriveReadMoreUrl(links) };
  }

  return item;
}

export { DEFAULT_LABEL, deriveReadMoreUrl, normaliseLinks };
