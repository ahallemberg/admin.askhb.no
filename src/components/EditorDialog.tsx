import { X } from 'lucide-react';

/*
 * The chrome every entry editor shares: a full-viewport surface, the fields on
 * one side and a live preview on the other, with the title bar and the save
 * controls pinned so neither scrolls away from a long form.
 *
 * Full-viewport rather than a centred panel because the preview has a width it
 * has to hit -- the site's reading measure -- and a panel wide enough to hold
 * that beside a column of fields is not a panel any more.
 *
 * Above the large breakpoint the two sides scroll independently, so a preview
 * stays put while the form under the pointer moves. Below it they are one column
 * in one scroller, fields first: a preview pinned beside a form on a phone would
 * leave neither enough width to be usable, and the entry being described is the
 * more useful thing to reach first.
 */
const EditorDialog: React.FC<{
    title: string;
    isOpen: boolean;
    preview: React.ReactNode;
    onClose: () => void;
    onSave: () => void;
    children: React.ReactNode;
}> = ({ title, isOpen, preview, onClose, onSave, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
            <header className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
                <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
                <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Close"
                >
                    <X className="w-5 h-5" />
                </button>
            </header>

            {/*
             * The height has to be allowed to shrink below its content for the
             * two panes to scroll rather than the page, and grid items default to
             * refusing that -- hence the explicit minimum on this row and on both
             * columns.
             */}
            <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-2 lg:overflow-hidden">
                <div className="min-h-0 p-6 lg:overflow-y-auto">
                    {children}
                </div>

                {/* The pane scrolls its own content rather than being scrolled,
                    so the theme switch above it stays reachable at the top of a
                    long entry. Below the breakpoint it has no height of its own
                    and simply extends the single scroller. */}
                <div className="min-h-0 border-t border-gray-200 bg-gray-50 lg:overflow-hidden lg:border-t-0 lg:border-l">
                    {preview}
                </div>
            </div>

            <footer className="flex shrink-0 justify-end gap-3 border-t border-gray-200 px-6 py-4">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={onSave}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                    Save
                </button>
            </footer>
        </div>
    );
};

export default EditorDialog;
