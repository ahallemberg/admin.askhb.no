import { useEffect } from 'react';
import { Check } from 'lucide-react';

const VISIBLE_MS = 4000;

/*
 * The one thing in the app that says something and then gets out of the way.
 * Success only: a save that worked needs acknowledging, not acting on, so it
 * does not earn a place in the header the way a failure does.
 *
 * role=status rather than alert -- a polite announcement that does not interrupt
 * whatever a screen reader is already saying, which matches a message nobody has
 * to respond to.
 */
const Toast: React.FC<{
    message: string;
    onDismiss: () => void;
}> = ({ message, onDismiss }) => {
    /*
     * onDismiss has to be stable, and the caller keeps it that way. An inline
     * arrow would be a new value on every render of the parent, restarting this
     * countdown each time -- and the parent re-renders on every edit elsewhere in
     * the editor, so the toast would sit there long past its welcome.
     */
    useEffect(() => {
        const timer = setTimeout(onDismiss, VISIBLE_MS);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
            <div
                role="status"
                className="pointer-events-auto flex items-center gap-3 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-paper shadow-xl"
            >
                <Check className="h-4 w-4 text-green-300" />
                {message}
            </div>
        </div>
    );
};

export default Toast;
