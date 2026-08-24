import { AlertTriangle, Info, X } from 'lucide-react';

type Tone = 'error' | 'warning' | 'info';

/*
 * The counterpart to Toast: a strip under the header that stays until it is
 * dealt with. A partial save leaves askhb.no serving a mix of old and new, and
 * the worker has no way to un-publish the half that landed -- so that message
 * has to outlive the glance that a toast is designed for.
 *
 * The dismiss control clears the message and nothing else. Whatever the message
 * was describing is a separate piece of state, and it keeps saying so through
 * the unsaved-changes indicator.
 */
const TONES: Record<Tone, { surface: string; icon: typeof AlertTriangle }> = {
    error: { surface: 'bg-red-50 border-red-200 text-red-900', icon: AlertTriangle },
    warning: { surface: 'bg-amber-50 border-amber-200 text-amber-900', icon: AlertTriangle },
    info: { surface: 'bg-white border-gray-200 text-gray-700', icon: Info }
};

const Notice: React.FC<{
    tone: Tone;
    children: React.ReactNode;
    action?: { label: string; onClick: () => void };
    onDismiss?: () => void;
}> = ({ tone, children, action, onDismiss }) => {
    const { surface, icon: Icon } = TONES[tone];

    return (
        <div
            // assertive for an error, because it reports something already true of
            // the live site rather than something about to happen.
            role={tone === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm leading-relaxed ${surface}`}
        >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">{children}</div>

            {action && (
                <button
                    type="button"
                    onClick={action.onClick}
                    className="shrink-0 rounded-md border border-current px-3 py-1 text-xs font-semibold transition-colors hover:bg-black/5"
                >
                    {action.label}
                </button>
            )}

            {onDismiss && (
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                    className="shrink-0 rounded p-1 opacity-60 transition-opacity hover:opacity-100"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
};

export default Notice;
