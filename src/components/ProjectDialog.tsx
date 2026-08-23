import { useState } from "react";
import type { ProjectItem } from "../types/props";
import { X } from "lucide-react";
import EditorDialog from "./EditorDialog";
import ImageUploadField from "./ImageUploadField";
import ProjectPreview from "./preview/ProjectPreview";
import PreviewSurface from "./preview/PreviewSurface";
import { deepEqual } from "../func/compare";
import { SCREENSHOT_DIR } from "../constants/app";

const FIELD_CLASS = "w-full p-3 border border-rule rounded-lg focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors";

// Optional text is stored absent rather than empty, so a cleared field leaves no
// `"url": ""` behind for askhb.no to render as a link to nowhere. Same rule as
// location/commitment on an organisation.
const orUndefined = (value: string) => value === '' ? undefined : value;

const ProjectDialog: React.FC<{
    project: ProjectItem;
    isOpen: boolean;
    isEditing: boolean;
    onClose: () => void;
    onSave: (project: ProjectItem) => void;
}> = ({ project, isOpen, isEditing, onClose, onSave }) => {
    const [draft, setDraft] = useState<ProjectItem>(project);
    // A skill typed but not yet added lives only here, so handleClose has to know
    // about it or closing would drop it without a word.
    const [newSkill, setNewSkill] = useState('');

    const update = (patch: Partial<ProjectItem>) => setDraft(prev => ({ ...prev, ...patch }));

    const skills = draft.skills ?? [];

    const addSkill = () => {
        if (newSkill && !skills.includes(newSkill)) {
            update({ skills: [...skills, newSkill] });
            setNewSkill('');
        }
    };

    const removeSkill = (index: number) => {
        const next = skills.filter((_, i) => i !== index);
        // Absent rather than [], so an emptied list leaves no "skills": [] in the JSON.
        update({ skills: next.length > 0 ? next : undefined });
    };

    const handleClose = () => {
        const hasDraft = !deepEqual(draft, project) || newSkill.trim() !== '';
        if (hasDraft && !window.confirm('Discard changes to this project?')) {
            return;
        }
        onClose();
    };

    if (!isOpen) return null;

    // A figure with no caption reads as a bare number on the portfolio, and a caption
    // with no figure renders a label for nothing. Warned rather than blocked: it is a
    // presentation nicety, not a correctness problem, and a half-filled pair is a
    // reasonable state to leave a draft in.
    const figurePairIncomplete = (!!draft.figure) !== (!!draft.figureCaption);

    return (
        <EditorDialog
            title={`${isEditing ? 'Edit' : 'Add'} Project`}
            isOpen={isOpen}
            onClose={handleClose}
            onSave={() => {
                onSave(draft);
                onClose();
            }}
            preview={
                <PreviewSurface note="Shown at the width the site gives a card in its two-column grid. The card is a link on the page; here it is not, so a click cannot lose the draft.">
                    <ProjectPreview project={draft} />
                </PreviewSurface>
            }
        >
            <div className="space-y-4">
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
                    <label className="block text-sm font-medium text-ink-muted mb-2">URL (optional)</label>
                    <input
                        type="text"
                        value={draft.url ?? ''}
                        onChange={(e) => update({ url: orUndefined(e.target.value) })}
                        className={FIELD_CLASS}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-ink-muted mb-2">Description</label>
                    <textarea
                        value={draft.description}
                        onChange={(e) => update({ description: e.target.value })}
                        rows={5}
                        className={FIELD_CLASS + " resize-none"}
                    />
                    <p className="mt-1 text-xs text-ink-faint">
                        Supports [text](https://example.com), **bold** and *italic*.
                    </p>
                </div>

                <ImageUploadField
                    label="Screenshot (optional)"
                    value={draft.screenshotUrl}
                    dir={SCREENSHOT_DIR}
                    owner={draft.name}
                    ownerLabel="project name"
                    onChange={(screenshotUrl) => update({ screenshotUrl })}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-ink-muted mb-2">Figure (optional)</label>
                        <input
                            type="text"
                            value={draft.figure ?? ''}
                            onChange={(e) => update({ figure: orUndefined(e.target.value) })}
                            className={FIELD_CLASS}
                        />
                        <p className="mt-1 text-xs text-ink-faint">e.g. "680,000"</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-ink-muted mb-2">Figure caption (optional)</label>
                        <input
                            type="text"
                            value={draft.figureCaption ?? ''}
                            onChange={(e) => update({ figureCaption: orUndefined(e.target.value) })}
                            className={FIELD_CLASS}
                        />
                        <p className="mt-1 text-xs text-ink-faint">e.g. "page views"</p>
                    </div>
                </div>

                {figurePairIncomplete && (
                    <p className="text-sm text-amber-700">
                        Figure and caption work as a pair — set both, or neither.
                    </p>
                )}

                <div>
                    <label className="block text-sm font-medium text-ink-muted mb-3">Skills (optional)</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {skills.map((skill, index) => (
                            <span
                                key={index}
                                className="inline-flex items-center gap-2 bg-rule rounded-full px-3 py-1 text-sm font-semibold text-ink-muted"
                            >
                                {skill}
                                <button
                                    type="button"
                                    onClick={() => removeSkill(index)}
                                    className="text-ink-faint hover:text-red-600 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Add skill"
                            value={newSkill}
                            onChange={(e) => setNewSkill(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                            className={`flex-1 ${FIELD_CLASS}`}
                        />
                        <button
                            type="button"
                            onClick={addSkill}
                            className="px-4 py-3 bg-ink text-paper rounded-lg hover:bg-ink-muted transition-colors"
                        >
                            Add
                        </button>
                    </div>
                </div>
            </div>
        </EditorDialog>
    );
};

export default ProjectDialog;
