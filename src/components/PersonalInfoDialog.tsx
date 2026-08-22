import { useState } from "react";
import type { PersonalInfo } from "../types/props";
import EditorDialog from "./EditorDialog";
import PersonalInfoPreview from "./preview/PersonalInfoPreview";
import PreviewSurface from "./preview/PreviewSurface";
import { deepEqual } from "../func/compare";

const FIELD_CLASS = "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors";

/*
 * The three fields this dialog owns. cvUrl is deliberately not among them: it is
 * set by CvSection, and a dialog that held a whole snapshot of the personal info
 * object would write its own copy of that field back on save. Saving merges
 * these three over whatever the object currently holds instead, so this dialog
 * can never be the thing that clears a CV link.
 */
type EditableFields = Pick<PersonalInfo, 'name' | 'title' | 'about'>;

const PersonalInfoDialog: React.FC<{
    personalInfo: PersonalInfo;
    isOpen: boolean;
    onClose: () => void;
    onSave: (fields: EditableFields) => void;
}> = ({ personalInfo, isOpen, onClose, onSave }) => {
    const [draft, setDraft] = useState<EditableFields>({
        name: personalInfo.name,
        title: personalInfo.title,
        about: personalInfo.about
    });

    const update = (patch: Partial<EditableFields>) => setDraft(prev => ({ ...prev, ...patch }));

    // Closing discards the draft outright, so confirm first when there is one.
    const handleClose = () => {
        const stored: EditableFields = {
            name: personalInfo.name,
            title: personalInfo.title,
            about: personalInfo.about
        };
        if (!deepEqual(draft, stored) && !window.confirm('Discard changes to your personal information?')) {
            return;
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <EditorDialog
            title="Edit Personal Information"
            isOpen={isOpen}
            onClose={handleClose}
            onSave={() => {
                onSave(draft);
                onClose();
            }}
            preview={
                <PreviewSurface note="The profile photo comes from the bucket and the social icons from the site's own repo; neither is edited here, and the icon row is left out.">
                    {/* The draft over the stored object, so the CV button previews
                        from the real cvUrl while the three fields track what is
                        being typed. */}
                    <PersonalInfoPreview personalInfo={{ ...personalInfo, ...draft }} />
                </PreviewSurface>
            }
        >
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                    <input
                        type="text"
                        value={draft.name}
                        onChange={(e) => update({ name: e.target.value })}
                        className={FIELD_CLASS}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                        type="text"
                        value={draft.title}
                        onChange={(e) => update({ title: e.target.value })}
                        className={FIELD_CLASS}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">About</label>
                    <textarea
                        value={draft.about}
                        onChange={(e) => update({ about: e.target.value })}
                        rows={14}
                        className={FIELD_CLASS + " resize-y"}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        A blank line starts a new paragraph. A single line break does not — it renders as a space.
                    </p>
                </div>
            </div>
        </EditorDialog>
    );
};

export default PersonalInfoDialog;
