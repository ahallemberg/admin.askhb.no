import { useState } from "react";
import type { PersonalInfo } from "../types/props";
import EditorDialog from "./EditorDialog";
import PersonalInfoPreview from "./preview/PersonalInfoPreview";
import PreviewSurface from "./preview/PreviewSurface";
import ProfilePictureField from "./ProfilePictureField";
import { deepEqual } from "../func/compare";

const FIELD_CLASS = "w-full p-3 border border-rule rounded-lg focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors";

/*
 * The fields this dialog owns. cvUrl is deliberately not among them: it is set
 * by CvSection, and a dialog that held a whole snapshot of the personal info
 * object would write its own copy of that field back on save. Saving merges
 * these over whatever the object currently holds instead, so this dialog can
 * never be the thing that clears a CV link.
 */
type EditableFields = Pick<PersonalInfo, 'name' | 'title' | 'about' | 'profilePictureUrl'>;

// Both the draft's starting point and what Cancel compares it against, written
// once so the two cannot drift apart as fields are added.
const editableFieldsOf = (info: PersonalInfo): EditableFields => ({
    name: info.name,
    title: info.title,
    about: info.about,
    profilePictureUrl: info.profilePictureUrl
});

const PersonalInfoDialog: React.FC<{
    personalInfo: PersonalInfo;
    isOpen: boolean;
    onClose: () => void;
    onSave: (fields: EditableFields) => void;
}> = ({ personalInfo, isOpen, onClose, onSave }) => {
    const [draft, setDraft] = useState<EditableFields>(editableFieldsOf(personalInfo));

    const update = (patch: Partial<EditableFields>) => setDraft(prev => ({ ...prev, ...patch }));

    // Closing discards the draft outright, so confirm first when there is one.
    const handleClose = () => {
        if (deepEqual(draft, editableFieldsOf(personalInfo))) {
            onClose();
            return;
        }

        /*
         * A replacement photo is in the bucket already -- the upload happens when
         * the file is chosen, not on save -- so discarding cannot bring the old
         * one back. All it decides is whether the site links the new URL now or
         * picks the photo up whenever its image cache expires. Said out loud
         * because "discard" is otherwise read as "undo".
         */
        const photoReplaced = draft.profilePictureUrl !== personalInfo.profilePictureUrl;
        const message = photoReplaced
            ? 'Discard changes? The new photo is already in the bucket, so this will not bring the old one back — it only leaves the site linking the previous URL.'
            : 'Discard changes to your personal information?';

        if (!window.confirm(message)) return;
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
                <PreviewSurface note="The row of social icons is left out: those come from the site's own repo rather than the bucket, so nothing here can read or edit them.">
                    {/* The draft over the stored object, so the CV button previews
                        from the real cvUrl while the three fields track what is
                        being typed. */}
                    <PersonalInfoPreview personalInfo={{ ...personalInfo, ...draft }} />
                </PreviewSurface>
            }
        >
            <div className="space-y-4">
                {/* First, because it is the first thing on the page it previews. */}
                <ProfilePictureField
                    value={draft.profilePictureUrl}
                    onChange={(profilePictureUrl) => update({ profilePictureUrl })}
                />

                <div>
                    <label className="block text-sm font-medium text-ink-muted mb-2">Name</label>
                    <input
                        type="text"
                        value={draft.name}
                        onChange={(e) => update({ name: e.target.value })}
                        className={FIELD_CLASS}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-ink-muted mb-2">Title</label>
                    <input
                        type="text"
                        value={draft.title}
                        onChange={(e) => update({ title: e.target.value })}
                        className={FIELD_CLASS}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-ink-muted mb-2">About</label>
                    <textarea
                        value={draft.about}
                        onChange={(e) => update({ about: e.target.value })}
                        rows={14}
                        className={FIELD_CLASS + " resize-y"}
                    />
                    <p className="mt-1 text-xs text-ink-faint">
                        A blank line starts a new paragraph. A single line break does not — it renders as a space. Supports [text](https://example.com), **bold** and *italic*.
                    </p>
                </div>
            </div>
        </EditorDialog>
    );
};

export default PersonalInfoDialog;
