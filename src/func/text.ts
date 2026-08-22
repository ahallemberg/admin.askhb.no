// Mirrors askhb.no's src/func/text.ts. R2 stores prose as one string with blank
// lines in it, and rendered in a single paragraph element each break collapses to
// a space. The site splits on blank lines before rendering; the preview has to
// split identically or an author typing a paragraph break here would see one
// result in the editor and a different one on the page.
//
// Undefined and whitespace-only input give an empty list, which also covers a
// field missing from a hand-edited file.
export const splitParagraphs = (text?: string): string[] =>
  typeof text === 'string' ? text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean) : [];
