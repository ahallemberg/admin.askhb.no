/*
 * Twin of askhb.no's src/func/richtext.ts. The logic is a copy and the two
 * change together, the same arrangement func/text.ts and func/organisations.ts
 * already use: the editor's preview has to parse by the rules the site renders
 * by, or the preview is confidently wrong. Only the indentation and these
 * comments differ -- this repo indents src/func at two spaces -- so `diff -w`
 * between them should show comment blocks and nothing else. Anything more is
 * drift, and drift here makes the preview lie.
 *
 * Three inline marks over the prose R2 stores as plain strings -- a
 * bracket-and-paren link, a doubled-star bold, a single-star italic -- and
 * nothing block-level. The page is a hand-tuned editorial layout, and remote
 * JSON must not be able to put a heading or a list into the middle of it.
 *
 * Nothing here throws. A draft being typed is not valid content yet, so half a
 * link is the normal state of this input rather than an error, and a parser that
 * raised on one would take the editor down mid-sentence.
 */

export type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'strong'; children: Segment[] }
  | { kind: 'em'; children: Segment[] }
  | { kind: 'link'; href: string; children: Segment[] };

// Past this, delimiters are left as the characters they are. Nesting this deep is
// a pathological input rather than a written one.
const MAX_DEPTH = 4;

const ABSOLUTE_SCHEME = /^(?:https?:\/\/|mailto:)/i;

// Reserved by RFC 2606, so it can never be a real destination and can never be
// reached by accident if one of these ever escapes as a live href.
const RELATIVE_SENTINEL = 'https://relative.invalid';

/*
 * Control characters have no business in a destination, and they are how a
 * scheme check gets walked past: a tab or a newline sitting inside the word
 * javascript is discarded by the parser that eventually reads the attribute, but
 * not by a plain prefix comparison.
 *
 * Tested by code point rather than by pattern. The equivalent character class
 * has to hold the characters themselves, which are invisible in the source and
 * which eslint objects to on sight.
 */
const hasControlChars = (value: string): boolean => {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }

  return false;
};

/*
 * Allowlisted, not blocklisted, so an unfamiliar scheme is refused by default.
 * The content is self-authored through an authenticated editor, so this is depth
 * rather than a live threat -- but it costs one predicate, and it means no path
 * runs from a bucket entry to script execution.
 */
const resolveHref = (raw: string): string | null => {
  const url = raw.trim();

  if (url === '' || hasControlChars(url)) return null;
  if (ABSOLUTE_SCHEME.test(url)) return url;

  /*
   * Site-relative, settled by resolving rather than by pattern. A leading slash
   * is not enough on its own: for an http(s) url a browser reads a backslash as
   * a slash, so "/\host" is an authority in disguise that resolves to that host
   * and walks straight past a check looking only for a doubled slash. Worse
   * than an ordinary external link, because the renderer keys target and rel
   * off the same leading slash and would give it neither.
   *
   * Resolving against a sentinel asks the question that actually matters --
   * does this stay on the origin it is written on -- instead of guessing at the
   * ways of writing one that does not.
   */
  if (url.startsWith('/')) {
    try {
      return new URL(url, RELATIVE_SENTINEL).origin === RELATIVE_SENTINEL ? url : null;
    } catch {
      return null;
    }
  }

  return null;
};

// Index of the closer matching the opener at `start`, or -1. Counts depth, so a
// label may hold brackets and a url may hold parens.
const findClosing = (text: string, start: number, open: string, close: string): number => {
  let depth = 0;

  for (let i = start; i < text.length; i += 1) {
    if (text[i] === open) {
      depth += 1;
    } else if (text[i] === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
};

interface LinkMatch {
  end: number;
  href: string | null;
  label: string;
}

const matchLink = (text: string, start: number): LinkMatch | null => {
  const labelEnd = findClosing(text, start, '[', ']');
  if (labelEnd === -1 || text[labelEnd + 1] !== '(') return null;

  const urlEnd = findClosing(text, labelEnd + 1, '(', ')');
  if (urlEnd === -1) return null;

  return {
    end: urlEnd + 1,
    href: resolveHref(text.slice(labelEnd + 2, urlEnd)),
    label: text.slice(start + 1, labelEnd),
  };
};

interface EmphasisMatch {
  end: number;
  length: number;
  inner: string;
}

/*
 * The opener must be followed by a non-space and the closer preceded by one.
 * That is the core of CommonMark's flanking rule, and it is what keeps
 * "2 * 3 * 4" arithmetic instead of italicising the 3.
 */
const matchEmphasis = (text: string, start: number): EmphasisMatch | null => {
  const length = text.startsWith('**', start) ? 2 : 1;
  const contentStart = start + length;
  const first = text[contentStart];

  if (first === undefined || /\s/.test(first)) return null;

  for (let i = contentStart; i < text.length; i += 1) {
    if (text[i] !== '*') continue;

    const runLength = text.startsWith('**', i) ? 2 : 1;

    // A run of the wrong width is not this mark's closer; step over all of it
    // so the halves of a doubled star are never read as a single one.
    if (runLength !== length || /\s/.test(text[i - 1])) {
      i += runLength - 1;
      continue;
    }

    // An empty body is not emphasis. Typing the closing pair before the content
    // is an ordinary way to write it, and without this the delimiters vanish from
    // the page for as long as the middle is empty, taking four typed characters
    // with them. Refused here, so they stay on screen as what they are.
    if (i === contentStart) return null;

    return { end: i + length, length, inner: text.slice(contentStart, i) };
  }

  return null;
};

/*
 * `linksAllowed` is false inside a link's own label, where a second link is left
 * as the characters it was written with. An anchor inside an anchor is invalid
 * HTML, and React builds it faithfully in the live DOM rather than unnesting it
 * the way an HTML parser would -- leaving only the inner one reachable and the
 * outer destination impossible to click. CommonMark refuses the same nesting.
 */
const parse = (text: string, depth: number, linksAllowed: boolean): Segment[] => {
  if (depth >= MAX_DEPTH) return text === '' ? [] : [{ kind: 'text', value: text }];

  const segments: Segment[] = [];
  let buffer = '';
  let i = 0;

  const flush = () => {
    if (buffer !== '') {
      segments.push({ kind: 'text', value: buffer });
      buffer = '';
    }
  };

  while (i < text.length) {
    const char = text[i];

    if (char === '[' && linksAllowed) {
      const link = matchLink(text, i);

      if (link) {
        /*
         * Structure parsed but the destination was refused, or there is no
         * label to click. The run goes out exactly as it was typed rather
         * than collapsing to its label: prose really does contain
         * "footnote[1] (see below)", and keeping the label alone would
         * print "1" and silently bin the rest of the sentence.
         */
        if (link.href === null || link.label.trim() === '') {
          buffer += text.slice(i, link.end);
        } else {
          flush();
          segments.push({
            kind: 'link',
            href: link.href,
            children: parse(link.label, depth + 1, false),
          });
        }

        i = link.end;
        continue;
      }
    }

    if (char === '*') {
      const emphasis = matchEmphasis(text, i);

      if (emphasis) {
        flush();
        segments.push({
          kind: emphasis.length === 2 ? 'strong' : 'em',
          children: parse(emphasis.inner, depth + 1, linksAllowed),
        });

        i = emphasis.end;
        continue;
      }
    }

    buffer += char;
    i += 1;
  }

  flush();
  return segments;
};

/*
 * Non-string input gives an empty list rather than throwing. The bucket is
 * hand-editable and nothing validates its shape on load, so a field missing from
 * an entry arrives here as undefined.
 */
export const parseInline = (text: unknown): Segment[] =>
  typeof text === 'string' ? parse(text, 0, true) : [];
