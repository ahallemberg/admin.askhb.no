import { useState } from "react";
import type { ProjectItem } from "../types/props";
import { X } from "lucide-react";
import ImageUploadField from "./ImageUploadField";
import { deepEqual } from "../func/compare";
import { SCREENSHOT_DIR } from "../constants/app";

const FIELD_CLASS = "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors";

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
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-900">
                        {isEditing ? 'Edit' : 'Add'} Project
                    </h3>
                    <button
                        onClick={handleClose}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">URL (optional)</label>
                        <input
                            type="text"
                            value={draft.url ?? ''}
                            onChange={(e) => update({ url: orUndefined(e.target.value) })}
                            className={FIELD_CLASS}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <textarea
                            value={draft.description}
                            onChange={(e) => update({ description: e.target.value })}
                            rows={5}
                            className={FIELD_CLASS + " resize-none"}
                        />
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">Figure (optional)</label>
                            <input
                                type="text"
                                value={draft.figure ?? ''}
                                onChange={(e) => update({ figure: orUndefined(e.target.value) })}
                                className={FIELD_CLASS}
                            />
                            <p className="mt-1 text-xs text-gray-500">e.g. "680,000"</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Figure caption (optional)</label>
                            <input
                                type="text"
                                value={draft.figureCaption ?? ''}
                                onChange={(e) => update({ figureCaption: orUndefined(e.target.value) })}
                                className={FIELD_CLASS}
                            />
                            <p className="mt-1 text-xs text-gray-500">e.g. "page views"</p>
                        </div>
                    </div>

                    {figurePairIncomplete && (
                        <p className="text-sm text-amber-700">
                            Figure and caption work as a pair — set both, or neither.
                        </p>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">Skills (optional)</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {skills.map((skill, index) => (
                                <span
                                    key={index}
                                    className="inline-flex items-center gap-2 bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700"
                                >
                                    {skill}
                                    <button
                                        type="button"
                                        onClick={() => removeSkill(index)}
                                        className="text-gray-400 hover:text-red-600 transition-colors"
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
                                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
                            />
                            <button
                                type="button"
                                onClick={addSkill}
                                className="px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onSave(draft);
                            onClose();
                        }}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProjectDialog;
