import QFreeMark from './QFreeMark';

/*
 * Mirrors askhb.no's src/components/LogoMark.tsx. The site renders marks as ink
 * rather than in their brand colours, through two mechanisms: a measured filter
 * chain for the alpha-transparent rasters, and a component for the one two-tone
 * mark a filter cannot handle. Both are reproduced here so the pane shows what
 * the page will show -- a preview that rendered every logo as a plain image
 * would be wrong about the one logo whose rendering is easy to get wrong.
 *
 * The filter values, the registry and the key normalisation are transferred, not
 * reinvented. See the site's copy for why brightness precedes invert in the dark
 * chain, and why the registry matches exactly rather than testing for a
 * substring.
 */
type MarkComponent = React.FC<{ className?: string; label?: string }>;

const MARK_ALIASES: Record<string, MarkComponent> = {
    'logo-qfree': QFreeMark,
    'q-free': QFreeMark,
    'q-free_logo': QFreeMark,
};

/*
 * Strips separators and case before matching. This app's own uploader is what
 * makes it necessary: it rewrites every run of non-alphanumeric characters in a
 * chosen file name to a hyphen, so a mark uploaded here arrives spelled
 * differently from the same mark uploaded earlier. Matching the raw name is what
 * put the site's one un-filterable logo on the filter branch in production.
 */
const normalise = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const MARKS: Record<string, MarkComponent> = Object.fromEntries(
    Object.entries(MARK_ALIASES).map(([alias, Mark]) => [normalise(alias), Mark]),
);

// Last path segment, without query, fragment or extension, reduced to its
// letters and digits. The stored URL carries a cache-busting query string, so
// stripping it is not optional here.
const markKey = (url: string): string =>
    normalise(url.split(/[?#]/)[0].split('/').pop()?.replace(/\.[^./]+$/, '') ?? '');

interface LogoMarkProps {
    url?: string;
    // Optical size correction; marks differ in ink coverage, so identical boxes
    // do not give identical visual weight. Default 1.
    scale?: number;
    alt?: string;
}

const LogoMark: React.FC<LogoMarkProps> = ({ url, scale = 1, alt = '' }) => {
    // Nothing at all rather than a reserved empty box, so an organisation with no
    // logo previews flush left exactly as it renders.
    if (!url) return null;

    /*
     * hasOwn rather than a bare index: the key comes from a stored URL, so a
     * logo saved under a name that collides with an inherited property would
     * otherwise reach the prototype chain, return something truthy that is not a
     * component, and throw inside React instead of falling through to the image.
     */
    const key = markKey(url);
    const Mark = Object.hasOwn(MARKS, key) ? MARKS[key] : undefined;

    return (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center">
            <span
                style={{ transform: `scale(${scale})` }}
                className="flex h-full w-full items-center justify-center"
            >
                {/* A component mark paints from the tokens and sets its own alpha,
                    so no weight correction is applied at this level. */}
                {Mark
                    ? <Mark className="max-h-full max-w-full" label={alt} />
                    : (
                        <img
                            src={url}
                            alt={alt}
                            className="max-h-full max-w-full object-contain [filter:grayscale(1)_brightness(0.7)_opacity(0.75)] dark:[filter:grayscale(1)_brightness(0.75)_invert(1)_opacity(0.7)]"
                        />
                    )}
            </span>
        </span>
    );
};

export default LogoMark;
