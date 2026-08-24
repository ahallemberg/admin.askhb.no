import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { type ConfirmRequest } from '../func/confirmContext';

/*
 * The modal that replaced window.confirm. Presentational: it owns no decision,
 * only the interaction, and hands the answer back through onResolve.
 *
 * Portalled to the body rather than rendered in place. EditorDialog is fixed to
 * the viewport and so creates its own stacking context; a confirm rendered as a
 * sibling of the editor's own tree would sit above it only by accident of where
 * it happened to mount. The portal makes that a guarantee instead.
 *
 * Everything below re-earns something the browser dialog gave away free, and the
 * list is the reason this file is longer than the markup it renders: focus moves
 * in on open and cannot leave, Escape and the backdrop both cancel, the cancel
 * button holds focus so a stray Return cannot delete anything, and the title is
 * announced with the dialog.
 */
const ConfirmDialog: React.FC<{
    request: ConfirmRequest;
    onResolve: (confirmed: boolean) => void;
}> = ({ request, onResolve }) => {
    const surfaceRef = useRef<HTMLDivElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();

    // The cancel button, not the dialog: landing on the safe choice is what makes
    // a reflexive Return harmless.
    useEffect(() => {
        cancelRef.current?.focus();
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onResolve(false);
                return;
            }

            if (event.key !== 'Tab') return;

            // Only ever two buttons, so the trap is the two ends of the list
            // rather than a general focusable-node walk.
            const buttons = surfaceRef.current?.querySelectorAll<HTMLElement>('button');
            if (!buttons || buttons.length === 0) return;

            const first = buttons[0];
            const last = buttons[buttons.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        // Capture, so a handler on anything underneath cannot see the key first.
        // Nothing in the app listens for Escape today, but the editor dialog this
        // often opens over is exactly the sort of thing that would grow one.
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [onResolve]);

    const tone = request.tone ?? 'danger';
    const Icon = tone === 'warning' ? AlertTriangle : Trash2;

    return createPortal(
        <div
            // Above EditorDialog, which pins itself one level below this.
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/45 p-6"
            onMouseDown={event => {
                // mousedown, not click: a click whose press started inside the
                // panel and released on the backdrop would otherwise cancel a
                // dialog the user was only selecting text in.
                if (event.target === event.currentTarget) onResolve(false);
            }}
        >
            <div
                ref={surfaceRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="w-full max-w-md rounded-xl bg-paper p-6 shadow-2xl"
            >
                <div className="flex items-start gap-3">
                    <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            tone === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                        }`}
                    >
                        <Icon className="h-5 w-5" />
                    </div>
                    <h2 id={titleId} className="pt-2 text-lg font-semibold text-ink">
                        {request.title}
                    </h2>
                </div>

                <div className="mt-3 text-sm leading-relaxed text-ink-muted">{request.body}</div>

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={() => onResolve(false)}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-rule-faint hover:text-ink"
                    >
                        {request.cancelLabel ?? 'Cancel'}
                    </button>
                    <button
                        type="button"
                        onClick={() => onResolve(true)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium text-paper transition-colors ${
                            tone === 'warning' ? 'bg-ink hover:bg-ink-muted' : 'bg-red-600 hover:bg-red-700'
                        }`}
                    >
                        {request.confirmLabel ?? 'Confirm'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConfirmDialog;
