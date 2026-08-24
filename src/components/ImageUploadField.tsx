import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { uploadFileToR2 } from '../func/data';
import { R2_GET_ENDPOINT, R2_PUT_ENDPOINT } from '../constants/app';
import { useConfirm } from '../func/confirmContext';
import { keyFor } from '../func/keys';

const ImageUploadField: React.FC<{
    label: string;
    value?: string;
    dir: string;
    // The owning entry's name — the organisation's company, the project's name. The
    // upload key is derived from it, so the field takes the raw string and slugifies
    // it here rather than trusting a caller to have done it.
    owner: string;
    // What to call that name in the "set it first" hint, e.g. "company name".
    ownerLabel: string;
    onChange: (url: string | undefined) => void;
}> = ({ label, value, dir, owner, ownerLabel, onChange }) => {
    const confirm = useConfirm();
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Only the newest upload may write state. A slow one landing after the user
    // cleared the field would otherwise silently set the URL again.
    const ticketRef = useRef(0);

    // An unnamed entry has nothing to key its uploads by, and a blank prefix would
    // put every unnamed entry's `logo.png` back on one object — the collision this
    // scheme exists to remove. So the name comes first; the fingerprint covers every
    // other degenerate case, but it cannot invent a difference that is not there.
    const canUpload = owner.trim() !== '';

    /*
     * Whether picking this file destroys the object the field currently points at.
     * Only a key collision does: a different filename for the same owner writes a
     * new object and leaves the old one reachable, so prompting there would be
     * asking about a loss that is not happening.
     *
     * Compared without the query, because the stored url carries a cache buster
     * and the object path is the part that decides what gets overwritten.
     */
    const overwritesCurrent = (file: File) =>
        !!value && value.split('?')[0] === `${R2_GET_ENDPOINT}${keyFor(dir, owner, file)}`;

    const handleFile = async (file: File) => {
        if (overwritesCurrent(file)) {
            const confirmed = await confirm({
                title: 'Replace this image?',
                body: (
                    <p>
                        The new file has the same name, so it overwrites the current one in the
                        bucket as soon as it uploads. There is no version to restore, and cancelling
                        this dialog will not bring the old image back.
                    </p>
                ),
                confirmLabel: 'Replace image'
            });
            if (!confirmed) return;
        }

        const ticket = ++ticketRef.current;
        setIsUploading(true);
        setError(null);
        try {
            const key = keyFor(dir, owner, file);
            await uploadFileToR2(file, R2_PUT_ENDPOINT + key, import.meta.env.VITE_WORKER_SHARED_SECRET);
            if (ticket !== ticketRef.current) return;
            // r2.askhb.no serves images with max-age=14400, so a replacement at the
            // same key stays hidden behind the edge cache without a fresh query.
            onChange(`${R2_GET_ENDPOINT}${key}?v=${Date.now()}`);
        } catch (uploadError) {
            if (ticket !== ticketRef.current) return;
            setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
        } finally {
            if (ticket === ticketRef.current) setIsUploading(false);
        }
    };

    const handleRemove = () => {
        // Invalidate any upload still in flight, otherwise it would set the URL
        // again when it lands and undo this. The button is disabled while
        // uploading, so this is a backstop rather than the usual path — but it
        // has to reset isUploading too: the invalidated upload's own cleanup
        // skips that write once its ticket is stale.
        ticketRef.current++;
        setIsUploading(false);
        setError(null);

        // Clears the stored link only. The file itself stays in the bucket and
        // remains publicly reachable at its URL.
        onChange(undefined);
    };

    return (
        <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">{label}</label>
            <div className="flex items-center gap-3">
                {value && <img src={value} alt="" className="w-10 h-10 object-contain border border-rule rounded" />}
                <label
                    className={`flex items-center gap-2 px-3 py-2 border border-rule rounded-lg transition-colors ${
                        canUpload ? 'cursor-pointer hover:bg-rule-faint' : 'opacity-40 cursor-not-allowed'
                    }`}
                    title={canUpload ? undefined : `Set the ${ownerLabel} first`}
                >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">{isUploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}</span>
                    <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        // A click on the label reaches a disabled input and opens no
                        // picker, so this gates the whole control, not just the input.
                        disabled={isUploading || !canUpload}
                        onChange={event => {
                            const file = event.target.files?.[0];
                            if (file) handleFile(file);
                            // Without this the same filename picked twice in a row
                            // fires no change event, so re-uploading after a remove
                            // would silently do nothing.
                            event.target.value = '';
                        }}
                    />
                </label>
                {value && (
                    <button
                        type="button"
                        onClick={handleRemove}
                        disabled={isUploading}
                        className="p-2 text-ink-faint hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title={isUploading ? 'Wait for the upload to finish' : 'Remove'}
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
            {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
            {!canUpload && (
                <p className="mt-1 text-sm text-amber-700">
                    Set the {ownerLabel} first — the upload key is derived from it, so that two entries
                    cannot overwrite each other's image.
                </p>
            )}
            <p className="mt-1 text-xs text-ink-faint">
                Uploading is itself a publish: the file goes to the bucket the moment you choose it,
                whether or not you save. Removing clears the link only. The file stays in the bucket and
                remains publicly reachable.
            </p>
        </div>
    );
};

export default ImageUploadField;
