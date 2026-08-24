import { useCallback, useRef, useState, type ReactNode } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { ConfirmContext, type ConfirmRequest } from '../func/confirmContext';

interface Pending {
    request: ConfirmRequest;
    resolve: (confirmed: boolean) => void;
    trigger: Element | null;
}

/*
 * Holds the one pending confirm and renders the one dialog, so every caller in
 * the app gets `if (!(await confirm(...))) return;` -- the same shape the four
 * window.confirm call sites already had, which is why converting them is a line
 * each rather than a restructure.
 *
 * Mounted once, around the editor. The dialog is portalled to the body from
 * inside ConfirmDialog, so where this sits in the tree does not decide what it
 * renders above.
 */
const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [pending, setPending] = useState<Pending | null>(null);

    // Mirrors `pending` for the guard below. Reading state there would be stale
    // within a single tick, which is exactly when a double call arrives.
    const isOpen = useRef(false);

    const confirm = useCallback((request: ConfirmRequest) => {
        if (isOpen.current) {
            /*
             * Two overlapping confirms is a caller bug -- a modal blocks the UI,
             * so nothing a person does can produce one. Resolving false quietly
             * would be the worst of the options: it is a *destructive* answer for
             * any request whose safe choice is the confirming one, and it would
             * hide the bug behind an outcome that looks deliberate.
             *
             * So it is loud where someone is watching and safe where they are
             * not. The local-drafts work adds the caller this matters for.
             */
            if (import.meta.env.DEV) {
                throw new Error('confirm() was called while a confirm dialog was already open');
            }
            return Promise.resolve(false);
        }

        isOpen.current = true;
        return new Promise<boolean>(resolve => {
            setPending({ request, resolve, trigger: document.activeElement });
        });
    }, []);

    // Reads `pending` rather than using the updater form, because everything here
    // is a side effect: StrictMode invokes updaters twice, which would settle the
    // promise and move focus twice per answer.
    const resolvePending = useCallback((confirmed: boolean) => {
        if (!pending) return;

        isOpen.current = false;
        setPending(null);

        /*
         * Focus has to go somewhere real. Confirming a card delete unmounts the
         * button that opened the dialog, and focusing a detached node does
         * nothing at all -- focus falls to the document and the next Tab starts
         * from the top of the page, which window.confirm never did.
         */
        const { trigger, request, resolve } = pending;
        const restorable = trigger instanceof HTMLElement && document.contains(trigger);
        const target = restorable ? trigger : request.fallbackFocus?.() ?? null;
        target?.focus();

        resolve(confirmed);
    }, [pending]);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {pending && <ConfirmDialog request={pending.request} onResolve={resolvePending} />}
        </ConfirmContext.Provider>
    );
};

export default ConfirmProvider;
