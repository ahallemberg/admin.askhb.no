import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { captureScreenshot, type CaptureTheme } from '../func/data';
import { R2_GET_ENDPOINT, SCREENSHOT_ENDPOINT, SCREENSHOT_DIR } from '../constants/app';
import { captureKeyFor } from '../func/keys';

/*
 * Renders the project's own site and stores the result, instead of asking for a
 * screenshot taken by hand.
 *
 * A sibling of the upload field rather than a replacement for it: the two write
 * to the same prefix (see captureKeyFor), so whichever ran last is what the site
 * shows, and a site the worker will not render can still have an image uploaded.
 */

type Status =
    | { state: 'idle' }
    | { state: 'capturing' }
    | { state: 'done'; message: string }
    | { state: 'partial'; message: string }
    | { state: 'error'; message: string };

const ScreenshotCapture: React.FC<{
    // The project's live URL, which is the default page to capture. The worker
    // renders only hosts it has been configured with, so an unlisted one comes
    // back as a refusal naming itself.
    url?: string;
    // The page to capture instead, when the landing page is not the one worth
    // showing. Stored on the project, so a later re-capture takes the same page.
    sourceUrl?: string;
    onSourceUrlChange: (value: string | undefined) => void;
    // The project's name, which the storage key is derived from.
    owner: string;
    light?: string;
    dark?: string;
    onCaptured: (urls: { light?: string; dark?: string }) => void;
    onRemoveDark: () => void;
}> = ({ url, sourceUrl, onSourceUrlChange, owner, light, dark, onCaptured, onRemoveDark }) => {
    const [withDark, setWithDark] = useState(false);
    const [status, setStatus] = useState<Status>({ state: 'idle' });
    // Only the newest capture may write state, so a slow one landing after the
    // user started another cannot overwrite the newer result.
    const ticketRef = useRef(0);

    /*
     * An empty field means the landing page, rather than meaning nothing: the
     * common case is capturing the project's own url, so typing it out again
     * would be busywork and leaving it blank has to keep working.
     */
    const target = (sourceUrl ?? '').trim() || (url ?? '').trim();
    const canCapture = owner.trim() !== '' && target !== '';

    const handleCapture = async () => {
        const ticket = ++ticketRef.current;
        setStatus({ state: 'capturing' });

        const themes: CaptureTheme[] = withDark ? ['light', 'dark'] : ['light'];

        try {
            const result = await captureScreenshot(
                SCREENSHOT_ENDPOINT,
                import.meta.env.VITE_WORKER_SHARED_SECRET,
                { url: target, key: captureKeyFor(SCREENSHOT_DIR, owner), themes },
            );

            if (ticket !== ticketRef.current) return;

            /*
             * One version for the whole capture. r2.askhb.no serves images with
             * max-age=14400 and the keys are stable, so without a fresh query a
             * replacement stays hidden behind the edge cache.
             */
            const version = Date.now();
            const urlFor = (theme: CaptureTheme) => {
                const entry = result.stored.find(item => item.theme === theme);
                return entry ? `${R2_GET_ENDPOINT}/${entry.key}?v=${version}` : undefined;
            };

            const captured = { light: urlFor('light'), dark: urlFor('dark') };
            if (captured.light || captured.dark) onCaptured(captured);

            if (result.failed) {
                /*
                 * A failed theme does not mean an empty key: an earlier capture
                 * may still be there, and it keeps being served. Saying so is the
                 * difference between "the dark shot is missing" and "the dark
                 * shot is old", which look identical on the card.
                 */
                setStatus({
                    state: 'partial',
                    message: `The ${result.failed.theme} capture failed`
                        + (result.failed.existing
                            ? ' — the previous one is still in the bucket and still what the site will show.'
                            : ' — nothing is stored under that key.')
                        + ` ${result.error ?? ''}`,
                });
                return;
            }

            setStatus({
                state: 'done',
                message: themes.length > 1 ? 'Captured light and dark.' : 'Captured.',
            });
        } catch (captureError) {
            if (ticket !== ticketRef.current) return;
            setStatus({
                state: 'error',
                message: captureError instanceof Error ? captureError.message : 'Capture failed',
            });
        }
    };

    const isCapturing = status.state === 'capturing';

    return (
        <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">Capture from the site</span>

            {/*
             * Wrapping rather than a sibling with a matching id: the label has to
             * name this input, and a plain <label> next to a field associates
             * with nothing at all.
             */}
            <label className="block mb-3">
                <span className="sr-only">Page to capture</span>
                <input
                    type="text"
                    value={sourceUrl ?? ''}
                    onChange={event => onSourceUrlChange(event.target.value.trim() === '' ? undefined : event.target.value)}
                    placeholder={url || 'https://example.com/some/page'}
                    disabled={isCapturing}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
                />
            </label>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={handleCapture}
                    disabled={isCapturing || !canCapture}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg transition-colors enabled:hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={canCapture ? undefined : 'Set the project name, and a URL to capture'}
                >
                    <Camera className="w-4 h-4" />
                    <span className="text-sm">{isCapturing ? 'Capturing…' : 'Capture'}</span>
                </button>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                        type="checkbox"
                        checked={withDark}
                        onChange={event => setWithDark(event.target.checked)}
                        disabled={isCapturing}
                    />
                    Also capture dark
                </label>
            </div>

            {(light || dark) && (
                <div className="mt-3 flex flex-wrap items-start gap-4">
                    {light && (
                        <figure className="m-0">
                            <img src={light} alt="" className="w-40 border border-gray-200 rounded" />
                            <figcaption className="mt-1 text-xs text-gray-500">Light</figcaption>
                        </figure>
                    )}
                    {dark && (
                        <figure className="m-0">
                            <img src={dark} alt="" className="w-40 border border-gray-200 rounded" />
                            <figcaption className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                                Dark
                                <button
                                    type="button"
                                    onClick={onRemoveDark}
                                    disabled={isCapturing}
                                    className="text-gray-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                                    title="Clear the dark link"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </figcaption>
                        </figure>
                    )}
                </div>
            )}

            {status.state === 'error' && <p className="mt-1 text-sm text-red-700">{status.message}</p>}
            {status.state === 'partial' && <p className="mt-1 text-sm text-amber-700">{status.message}</p>}
            {status.state === 'done' && <p className="mt-1 text-sm text-green-700">{status.message}</p>}

            {!canCapture && (
                <p className="mt-1 text-sm text-amber-700">
                    Set the project name and URL first — a URL is what gets rendered, and the storage
                    key is derived from the name.
                </p>
            )}

            {/*
             * The dark caveat is the one thing here that fails silently. Forcing
             * dark can only surface a mode the site already has; against a site
             * with none it captures the ordinary light page and stores it as the
             * dark one, and reports success. Nothing downstream can tell.
             */}
            <p className="mt-1 text-xs text-gray-500">
                Leave the page blank to capture the project's own URL, or give any page on the same
                site — the shot does not have to be the front page. Only tick dark if the site actually has a dark mode. There is no way to detect that it
                does not — the capture succeeds and stores the light page as the dark one. Capturing is
                itself a publish: the image goes to the bucket whether or not you save, and replaces
                whatever that project's last capture left there.
            </p>
        </div>
    );
};

export default ScreenshotCapture;
