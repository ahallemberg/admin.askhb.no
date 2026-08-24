import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { FILE_NAME, type FileKey } from '../func/resolveDraft';

/*
 * Shown when a restored draft turns out to have forked from content the bucket no
 * longer holds -- another device saved in between, or this browser's own last
 * save only half landed.
 *
 * Not a useConfirm caller, deliberately. This was never a boolean: it names files
 * and wants an answer per conflict, and the confirm dialog's whole shape is one
 * question with a safe default. Two different questions sharing one component
 * would make the safe default wrong for one of them.
 *
 * Only genuinely conflicting files appear. A file the draft never touched takes
 * the bucket's version without asking, and one only the draft changed keeps the
 * draft's -- so this usually asks about one file, and often is not shown at all.
 */
const StaleDraftDialog: React.FC<{
    conflicts: FileKey[];
    savedAt: number;
    // Set when the divergence is this browser's own half-landed save rather than
    // another session. Saying "the bucket changed" there would send the author
    // looking for an edit nobody made.
    ownPartialFailure: boolean;
    onResolve: (keep: Record<FileKey, 'draft' | 'bucket'>) => void;
    onDismiss: () => void;
}> = ({ conflicts, savedAt, ownPartialFailure, onResolve, onDismiss }) => {
    const titleId = useId();
    const [choice, setChoice] = useState<Record<string, 'draft' | 'bucket'>>(
        () => Object.fromEntries(conflicts.map(key => [key, 'draft']))
    );

    // Escape keeps the draft rather than resolving anything: nothing is lost by
    // deciding later, and the header keeps saying the draft is stale until
    // something is decided.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onDismiss();
            }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [onDismiss]);

    const when = new Date(savedAt).toLocaleString(undefined, {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/45 p-6">
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="w-full max-w-lg rounded-xl bg-paper p-6 shadow-2xl"
            >
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <h2 id={titleId} className="pt-2 text-lg font-semibold text-ink">
                        {ownPartialFailure
                            ? 'Your last save only partly landed'
                            : 'The bucket changed since these edits'}
                    </h2>
                </div>

                <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-muted">
                    <p>
                        Your unsaved draft is from <strong className="text-ink">{when}</strong>.{' '}
                        {ownPartialFailure
                            ? 'Some files reached the bucket and some did not, so what is there now is a mix of both.'
                            : 'These files have changed in the bucket since then, probably edited from another browser.'}
                    </p>
                    <p>
                        Everything else has been resolved already — files your draft never touched took
                        the bucket's version, and files only you changed kept yours. Choose for the rest.
                        The bucket keeps no versions, so what you drop here is gone.
                    </p>
                </div>

                <ul className="mt-4 flex flex-col gap-2">
                    {conflicts.map(key => (
                        <li key={key} className="flex flex-wrap items-center gap-3 rounded-lg border border-rule px-3 py-2">
                            <code className="flex-1 text-sm text-ink">{FILE_NAME[key]}</code>
                            <div className="flex gap-1">
                                {(['draft', 'bucket'] as const).map(side => (
                                    <button
                                        key={side}
                                        type="button"
                                        onClick={() => setChoice(prev => ({ ...prev, [key]: side }))}
                                        aria-pressed={choice[key] === side}
                                        className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                                            choice[key] === side
                                                ? 'bg-ink text-paper'
                                                : 'text-ink-muted hover:bg-rule-faint'
                                        }`}
                                    >
                                        {side === 'draft' ? 'Keep mine' : 'Take theirs'}
                                    </button>
                                ))}
                            </div>
                        </li>
                    ))}
                </ul>

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-rule-faint hover:text-ink"
                    >
                        Decide later
                    </button>
                    <button
                        type="button"
                        onClick={() => onResolve(choice as Record<FileKey, 'draft' | 'bucket'>)}
                        className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink-muted"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default StaleDraftDialog;
