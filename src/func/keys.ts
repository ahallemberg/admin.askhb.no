/*
 * How an entry's uploaded assets are named in the bucket.
 *
 * Shared rather than private to the upload field because a project's screenshot
 * can arrive two ways now -- picked from disk, or captured from the live site by
 * the worker -- and the two must land on the same prefix. Two naming schemes
 * would put one project's screenshots in two places in a bucket nothing can
 * delete from.
 */

// Nordic letters carry meaning that stripping them loses, and unlike é they do not
// decompose under NFD — "Bærum" and "Barum" are different places. Transliterated
// before the diacritic strip so they survive as ae/oe/aa.
const NORDIC: Record<string, string> = { 'æ': 'ae', 'ø': 'oe', 'å': 'aa' };

const slugify = (name: string) => name
    .toLowerCase()
    .replace(/[æøå]/g, character => NORDIC[character])
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    // Long enough to stay readable in the R2 browser, short enough that a rambling
    // name cannot push the key toward a length limit.
    .slice(0, 40);

// Distinguishes entries the slug alone cannot: "Q-Free" and "Q Free" slugify alike,
// and a name with no ASCII in it slugifies to nothing at all. FNV-1a over the raw
// name, so it is stable across sessions — the same entry always lands on the same
// prefix — while two distinct names practically never share one.
const fingerprint = (name: string) => {
    let hash = 2166136261;
    for (let index = 0; index < name.length; index++) {
        hash ^= name.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
};

// `..` is the one sanitised filename that would still mean something to a URL
// resolver: `/logos/x/..` normalises to `/logos/`, putting the PUT somewhere other
// than the key we computed. Dots are otherwise allowed, so they are collapsed rather
// than dropped, and a name that survives as nothing gets a placeholder.
const safeFileName = (name: string) => {
    const cleaned = name
        .toLowerCase()
        .replace(/[^a-z0-9.]+/g, '-')
        .replace(/\.{2,}/g, '.')
        .replace(/^\.+/, '');
    return cleaned === '' ? 'file' : cleaned;
};

// The directory an entry's assets live under: the entry's name, plus a fingerprint
// of it so that two entries can never share one.
//
// Renaming an entry leaves its stored URL pointing at the old prefix. That is
// accepted: the URL keeps working (the object is untouched and R2 serves it as
// before), and a re-upload after the rename writes to the new prefix, orphaning at
// most one object in a bucket that already accumulates them. What it cannot do is
// overwrite another entry's asset, which is the failure worth preventing.
const entryPrefix = (dir: string, owner: string) => {
    const slug = slugify(owner);
    return `${dir}${slug ? slug + '-' : ''}${fingerprint(owner)}/`;
};

// The key an uploaded file takes, so re-uploading the same asset for the same entry
// overwrites in place rather than littering a bucket the worker cannot delete from.
// That is also what stops Cancel from destroying someone else's logo: the file is
// already in R2 by the time the dialog asks whether to discard, and a filename-only
// key meant every entry's `logo.png` was the same object.
const keyFor = (dir: string, owner: string, file: File) =>
    `${entryPrefix(dir, owner)}${safeFileName(file.name)}`;

/*
 * The base key a capture is stored under. The worker appends `-light.png` or
 * `-dark.png`, so this carries no extension.
 *
 * No leading slash, unlike keyFor: an upload names its key in the request path,
 * where the slash separates it from the origin, while a capture names it in the
 * body, and the worker requires it to start with `screenshots/` exactly.
 */
const captureKeyFor = (dir: string, owner: string) =>
    `${entryPrefix(dir, owner)}shot`.replace(/^\/+/, '');

export { keyFor, captureKeyFor };
