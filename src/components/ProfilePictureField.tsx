import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { uploadFileToR2 } from '../func/data';
import { R2_GET_ENDPOINT, R2_PUT_ENDPOINT, PROFILE_PICTURE_PATH, R2_PROFILE_PICTURE } from '../constants/app';

type Status =
    | { state: 'idle' }
    | { state: 'uploading' }
    | { state: 'done' }
    | { state: 'error'; message: string };

/*
 * The header photo. One object, one fixed key, so this is not ImageUploadField:
 * that one derives a key from an owning entry's name to keep two entries apart,
 * and there is only one of these. It follows CvSection instead, which has the
 * same shape -- a singleton asset at a known path, replaced in place.
 *
 * No remove button, unlike both of those. Clearing a CV link hides a button and
 * clearing a logo leaves a name without a mark, but the site's header has no
 * state without a photo: the field only ever overrides the constant that points
 * at the same object, so removing it would change nothing a reader could see.
 *
 * The key stays profilepicture.png whatever the file is called or encoded as.
 * The extension is a name, not a declaration -- the worker stores the uploaded
 * Content-Type on the object, so a JPEG served from that key is still served as
 * a JPEG and renders correctly.
 */
const ProfilePictureField: React.FC<{
    value?: string;
    onChange: (url: string) => void;
}> = ({ value, onChange }) => {
    const [status, setStatus] = useState<Status>({ state: 'idle' });
    // Only the newest upload may write state, so a slow one landing after a
    // newer replacement cannot put the older photo's URL back.
    const latestUpload = useRef(0);

    const isUploading = status.state === 'uploading';

    const handleFile = async (file: File) => {
        const ticket = ++latestUpload.current;
        setStatus({ state: 'uploading' });

        try {
            await uploadFileToR2(
                file,
                R2_PUT_ENDPOINT + PROFILE_PICTURE_PATH,
                import.meta.env.VITE_WORKER_SHARED_SECRET
            );

            if (ticket !== latestUpload.current) return;

            // Every upload overwrites the same key and r2.askhb.no serves images
            // with a 4 hour max-age, so the changing query is the only thing that
            // tells the edge cache -- and this preview -- that the bytes changed.
            onChange(`${R2_GET_ENDPOINT}${PROFILE_PICTURE_PATH}?v=${Date.now()}`);
            setStatus({ state: 'done' });
        } catch (error) {
            if (ticket !== latestUpload.current) return;

            setStatus({
                state: 'error',
                message: error instanceof Error ? error.message : 'Upload failed'
            });
        }
    };

    return (
        <div>
            <label className="block text-sm font-medium text-ink-muted mb-2">Profile photo</label>
            <div className="flex items-center gap-3">
                {/* The stored URL when there is one, so a fresh upload shows here
                    rather than whatever the browser cached for the bare key. */}
                <img
                    src={value || R2_PROFILE_PICTURE}
                    alt=""
                    className="w-16 h-16 object-contain border border-rule rounded"
                />
                <label
                    className={`flex items-center gap-2 px-3 py-2 border border-rule rounded-lg transition-colors ${
                        isUploading ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-rule-faint'
                    }`}
                >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">{isUploading ? 'Uploading…' : 'Replace photo'}</span>
                    <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={isUploading}
                        onChange={event => {
                            const file = event.target.files?.[0];
                            if (file) handleFile(file);
                            // Without this the same filename picked twice in a row
                            // fires no change event, so a retry after a failed
                            // upload would silently do nothing.
                            event.target.value = '';
                        }}
                    />
                </label>
            </div>

            {status.state === 'error' && <p className="mt-1 text-sm text-red-700">{status.message}</p>}

            <p className="mt-2 text-xs text-ink-faint">
                Square images work best; the site renders it small, so anything past about 512px is
                wasted bytes on every visit.
            </p>
            <p className="mt-1 text-xs text-ink-faint">
                Choosing a file replaces the photo in the bucket immediately, whether or not you save,
                and the one it replaces cannot be recovered. Cancel will not put it back. Saving is what
                gets the new photo past the site's four hour image cache — without it the change shows
                up whenever that expires.
            </p>
        </div>
    );
};

export default ProfilePictureField;
