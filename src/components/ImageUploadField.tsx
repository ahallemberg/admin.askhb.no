import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { uploadFileToR2 } from '../func/data';
import { R2_GET_ENDPOINT, R2_PUT_ENDPOINT } from '../constants/app';

// Keys are derived from the filename so re-uploading the same asset overwrites in
// place rather than littering the bucket — the worker supports no DELETE.
const keyFor = (dir: string, file: File) =>
    dir + file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');

const ImageUploadField: React.FC<{
    label: string;
    value?: string;
    dir: string;
    onChange: (url: string | undefined) => void;
}> = ({ label, value, dir, onChange }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Only the newest upload may write state. A slow one landing after the user
    // cleared the field would otherwise silently set the URL again.
    const ticketRef = useRef(0);

    const handleFile = async (file: File) => {
        const ticket = ++ticketRef.current;
        setIsUploading(true);
        setError(null);
        try {
            const key = keyFor(dir, file);
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
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <div className="flex items-center gap-3">
                {value && <img src={value} alt="" className="w-10 h-10 object-contain border border-gray-200 rounded" />}
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">{isUploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}</span>
                    <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        disabled={isUploading}
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
                        className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title={isUploading ? 'Wait for the upload to finish' : 'Remove'}
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
            {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
            <p className="mt-1 text-xs text-gray-500">
                Removing clears the link only. The file stays in the bucket and remains publicly reachable.
            </p>
        </div>
    );
};

export default ImageUploadField;
