import { useRef, useState } from 'react';
import type { PersonalInfo } from "../types/props";
import { Upload, FileText, Trash2 } from 'lucide-react';
import { uploadFileToR2 } from '../func/data';
import { useConfirm } from '../func/confirmContext';
import { R2_GET_ENDPOINT, R2_PUT_ENDPOINT, CV_PATH } from '../constants/app';

type Status =
    | { state: 'idle' }
    | { state: 'uploading' }
    | { state: 'done' }
    | { state: 'error'; message: string };

const CvSection: React.FC<{
    personalInfo: PersonalInfo;
    onUpdate: (field: keyof PersonalInfo, value: string) => void;
}> = ({ personalInfo, onUpdate }) => {
    const confirm = useConfirm();
    const [status, setStatus] = useState<Status>({ state: 'idle' });
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Every upload takes a ticket. Only the newest one is allowed to write state,
    // so a slow request that finishes after a newer upload — or after the user
    // removed the CV — cannot resurrect a link or report a stale result.
    const latestUpload = useRef(0);

    const isUploading = status.state === 'uploading';
    const hasCv = !!personalInfo.cvUrl;

    const handleFile = async (file: File) => {
        // Only when one is already linked. The first upload creates the object;
        // every later one overwrites the same key, and there is no way back.
        if (hasCv) {
            const confirmed = await confirm({
                title: 'Replace the CV?',
                body: (
                    <p>
                        The new PDF overwrites the current one in the bucket as soon as it uploads,
                        and goes live immediately — the link on askhb.no already points at that key.
                        There is no version to restore.
                    </p>
                ),
                confirmLabel: 'Replace CV'
            });
            if (!confirmed) return;
        }

        const ticket = ++latestUpload.current;
        setStatus({ state: 'uploading' });

        try {
            await uploadFileToR2(
                file,
                R2_PUT_ENDPOINT + CV_PATH,
                import.meta.env.VITE_WORKER_SHARED_SECRET
            );

            if (ticket !== latestUpload.current) return;

            // Every upload overwrites the same key, and r2.askhb.no serves it with
            // a 4 hour max-age, so without a changing query string a replacement
            // stays invisible behind the edge cache. The portfolio also shows its
            // download button only when cvUrl is set.
            onUpdate('cvUrl', `${R2_GET_ENDPOINT}${CV_PATH}?v=${Date.now()}`);
            setStatus({ state: 'done' });
        } catch (error) {
            if (ticket !== latestUpload.current) return;

            setStatus({
                state: 'error',
                message: error instanceof Error ? error.message : 'Upload failed'
            });
        }
    };

    const handleRemove = () => {
        // Invalidate any upload still in flight, otherwise it would set cvUrl again
        // when it lands and undo this.
        latestUpload.current++;

        // Clears the link so the portfolio hides the button. The file itself
        // stays in the bucket and remains publicly reachable at its URL.
        onUpdate('cvUrl', '');
        setStatus({ state: 'idle' });
    };

    return (
        <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">CV</h2>

            <div className="bg-paper rounded-lg p-6 shadow-sm border border-rule">
                {personalInfo.cvUrl ? (
                    <div className="flex items-center justify-between gap-4">
                        <a
                            href={personalInfo.cvUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-ink-muted hover:text-accent transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            <span className="text-sm">{personalInfo.cvUrl}</span>
                        </a>
                        <button
                            onClick={handleRemove}
                            disabled={isUploading}
                            title={isUploading ? 'Wait for the upload to finish' : 'Remove the CV link from the portfolio'}
                            className="text-ink-faint hover:text-red-600 disabled:text-rule disabled:cursor-not-allowed transition-colors"
                            aria-label="Remove CV from the portfolio"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <p className="text-sm text-ink-faint">
                        No CV linked. The portfolio hides its download button until one is
                        uploaded. Note that an uploaded PDF is publicly reachable at its URL
                        whether or not it is linked.
                    </p>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                        e.target.value = '';
                    }}
                />

                <div className="flex items-center gap-4 mt-4">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 bg-ink hover:bg-ink-muted disabled:bg-ink-faint disabled:cursor-not-allowed text-paper px-4 py-2 rounded-lg transition-colors"
                    >
                        <Upload className="w-4 h-4" />
                        {isUploading ? 'Uploading...' : hasCv ? 'Replace PDF' : 'Upload PDF'}
                    </button>

                    {status.state === 'done' && (
                        <p className="text-sm text-ink-muted">
                            Uploaded. The file is already public; press Save so the
                            site links this version instead of a cached one.
                        </p>
                    )}
                    {status.state === 'error' && (
                        <p className="text-sm text-red-600">{status.message}</p>
                    )}
                </div>
            </div>
        </section>
    );
};

export default CvSection;
