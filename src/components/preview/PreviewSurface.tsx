import { Sun, Moon } from 'lucide-react';
import { usePreviewTheme } from '../../func/previewTheme';

/*
 * The canvas every preview renders on: askhb.no's paper, its body face, its
 * reading measure, and a switch between the two themes the site ships.
 *
 * The width cap is the site's own text column -- the same box its header, prose
 * and entries all sit in. Matching it is what makes the preview worth having:
 * line lengths, wrap points and how a long role title breaks are all decided by
 * that measure, and a preview at pane width would get every one of them wrong.
 *
 * The theme switch earns its place because the palette is tuned per theme rather
 * than derived: the accent warms toward terracotta on dark, and the raster logo
 * marks invert. Nothing else in this app renders dark, so this pane is the only
 * place a dark-mode problem is visible before it is live.
 */
const PreviewSurface: React.FC<{ children: React.ReactNode; note?: string }> = ({ children, note }) => {
    const [theme, setTheme] = usePreviewTheme();

    const tab = (active: boolean) =>
        `flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${
            active ? 'bg-paper text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
        }`;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-6 pb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Live preview</p>
                {/* A pair of buttons rather than one toggle: which theme is showing
                    has to be readable at a glance, not inferred from an icon. */}
                <div className="flex items-center gap-0.5 rounded-md bg-rule-faint p-0.5" role="group" aria-label="Preview theme">
                    <button type="button" onClick={() => setTheme('light')} className={tab(theme === 'light')} aria-pressed={theme === 'light'}>
                        <Sun className="h-3.5 w-3.5" />
                        Light
                    </button>
                    <button type="button" onClick={() => setTheme('dark')} className={tab(theme === 'dark')} aria-pressed={theme === 'dark'}>
                        <Moon className="h-3.5 w-3.5" />
                        Dark
                    </button>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
                {/*
                 * The frame is chrome and stays light; the theme class goes on
                 * the surface inside it, not on the document, so the editor
                 * around a dark preview stays light too.
                 *
                 * The two are separate elements on purpose. Everything under the
                 * theme class inherits the palette, which is the point for the
                 * mirrored components -- but it would also catch any chrome that
                 * happened to sit inside, flipping a border or a caption to the
                 * preview's theme while the pane behind it stayed light. Keeping
                 * the class on the surface alone means only what is meant to be
                 * previewed can flip, and the note below is outside it for the
                 * same reason.
                 */}
                <div className="mx-auto w-full max-w-[36rem] overflow-hidden rounded border border-rule">
                    <div className={`font-preview bg-paper text-ink px-6 py-8 ${theme === 'dark' ? 'dark' : ''}`}>
                        {children}
                    </div>
                </div>

                {note && <p className="mx-auto mt-3 max-w-[36rem] text-xs text-ink-muted">{note}</p>}
            </div>
        </div>
    );
};

export default PreviewSurface;
