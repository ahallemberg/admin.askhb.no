import { createContext, useContext, type ReactNode } from 'react';

/*
 * The context half of the confirm dialog, kept apart from the provider that
 * renders it. A module exporting both a component and a hook trips the rule that
 * keeps fast refresh working, so the split is required rather than stylistic.
 */

interface ConfirmRequest {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  // Only styling: which of the two buttons reads as the destructive one. Cancel
  // is the safe answer for every request in this app, so there is no prop to
  // move that -- see ConfirmProvider for what a second request resolves to.
  tone?: 'danger' | 'warning';
  // Where focus goes when the element that opened the dialog is gone by the time
  // it closes, which is the ordinary case for a card delete: confirming it
  // unmounts the button that asked. Without this focus falls to the document and
  // keyboard navigation restarts at the top of the page.
  fallbackFocus?: () => HTMLElement | null;
}

type Confirm = (request: ConfirmRequest) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

// Throws rather than falling back to `window.confirm` or to a resolved promise.
// Either fallback would let a destructive action through with no prompt, or with
// a prompt this app cannot style -- both are the failure the component exists to
// prevent, and a missing provider is a wiring mistake, not a runtime condition.
const useConfirm = (): Confirm => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm was called outside a ConfirmProvider');
  }
  return confirm;
};

export { ConfirmContext, useConfirm, type Confirm, type ConfirmRequest };
