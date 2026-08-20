import { useRef, useState } from 'react';
import type { PersonalInfo } from "../types/props";
import { Upload, FileText, Trash2 } from 'lucide-react';
import { uploadFileToR2 } from '../func/data';
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
    const [status, setStatus] = useState<Status>({ state: 'idle' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        setStatus({ state: 'uploading' });

        try {
            await uploadFileToR2(
                file,
                R2_PUT_ENDPOINT + CV_PATH,
                import.meta.env.VITE_WORKER_SHARED_SECRET
            );

            // The portfolio shows its download button only when cvUrl is set, so
            // point it at the file we just uploaded. Saved with the rest of the
            // portfolio when Save is pressed.
            onUpdate('cvUrl', R2_GET_ENDPOINT + CV_PATH);
            setStatus({ state: 'done' });
        } catch (error) {
            setStatus({
                state: 'error',
                message: error instanceof Error ? error.message : 'Upload failed'
            });
        }
    };

    const handleRemove = () => {
        // Clears the link so the portfolio hides the button. The file itself
        // stays in the bucket.
        onUpdate('cvUrl', '');
        setStatus({ state: 'idle' });
    };

    return (
        <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">CV</h2>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                {personalInfo.cvUrl ? (
                    <div className="flex items-center justify-between gap-4">
                        <a
                            href={personalInfo.cvUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            <span className="text-sm">{personalInfo.cvUrl}</span>
                        </a>
                        <button
                            onClick={handleRemove}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            aria-label="Remove CV from the portfolio"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500">
                        No CV linked. The portfolio hides its download button until one is uploaded.
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
                        disabled={status.state === 'uploading'}
                        className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        <Upload className="w-4 h-4" />
                        {status.state === 'uploading'
                            ? 'Uploading...'
                            : personalInfo.cvUrl ? 'Replace PDF' : 'Upload PDF'}
                    </button>

                    {status.state === 'done' && (
                        <p className="text-sm text-gray-600">
                            Uploaded. Press Save to publish the change.
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
