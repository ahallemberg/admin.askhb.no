import { useState } from "react";
import type { ProjectItem } from "../types/props";
import EditorDialog from "./EditorDialog";
import ImageUploadField from "./ImageUploadField";
import ScreenshotCapture from "./ScreenshotCapture";
import SkillsEditor from "./SkillsEditor";
import ProjectPreview from "./preview/ProjectPreview";
import PreviewSurface from "./preview/PreviewSurface";
import { deepEqual } from "../func/compare";
import { useConfirm } from "../func/confirmContext";
import { PROJECT_LOGO_DIR, SCREENSHOT_DIR } from "../constants/app";

const FIELD_CLASS = "w-full p-3 border border-rule rounded-lg focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors";

// The bounds offered by the logo scale input, matching OrganisationDialog. Values
// outside them are still stored — nothing enforces an input's min/max — so they are
// called out instead, and the preview renders whatever is stored, unclamped.
const SCALE_MIN = 0.5;
const SCALE_MAX = 2;

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
    const confirm = useConfirm();
    const [draft, setDraft] = useState<ProjectItem>(project);
    // A skill typed but not yet added lives only here, so handleClose has to know
    // about it or closing would drop it without a word.
    const [newSkill, setNewSkill] = useState('');

    const update = (patch: Partial<ProjectItem>) => setDraft(prev => ({ ...prev, ...patch }));

    const skills = draft.skills ?? [];

    const scale = draft.logoScale;
    const scaleOutOfRange = scale !== undefined && (scale < SCALE_MIN || scale > SCALE_MAX);

    const handleClose = async () => {
        const hasDraft = !deepEqual(draft, project) || newSkill.trim() !== '';
        if (hasDraft && !(await confirm({
            title: 'Discard changes to this project?',
            body: <p>The edits in this dialog are thrown away. Nothing on askhb.no changes either way.</p>,
            confirmLabel: 'Discard changes'
        }))) {
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

                {/*
                 * Its own directory, not the organisations' LOGO_DIR. The suffix
                 * entryPrefix adds is a fingerprint of the owner's name, not a
                 * random one -- deterministic so that re-uploading an entry's
                 * asset overwrites in place -- so the directory is the only thing
                 * separating a project called "Ascend NTNU" from the employer of
                 * the same name. Shared, both would compute one prefix, and a
                 * logo.svg uploaded on either side would silently take the
                 * other's object: uploads publish on pick, and there is no
                 * versioning behind them and no DELETE to undo it with.
                 */}
                <ImageUploadField
                    label="Logo (optional)"
                    value={draft.logoUrl}
                    dir={PROJECT_LOGO_DIR}
                    owner={draft.name}
                    ownerLabel="project name"
                    onChange={(logoUrl) => update({ logoUrl })}
                />

                <div>
                    <label className="block text-sm font-medium text-ink-muted mb-2">Logo scale (optional)</label>
                    <input
                        type="number"
                        step="0.05"
                        min={SCALE_MIN}
                        max={SCALE_MAX}
                        value={scale ?? ''}
                        onChange={(e) => {
                            // A number input reads back an empty string for
                            // anything it cannot parse, and that coerces to zero —
                            // which would scale the mark out of existence. Store
                            // nothing instead, and never let a NaN reach the JSON.
                            const parsed = Number(e.target.value);
                            const next = e.target.value === '' || !Number.isFinite(parsed) ? undefined : parsed;
                            update({ logoScale: next });
                        }}
                        className={FIELD_CLASS}
                    />
                    <p className="mt-1 text-xs text-ink-faint">
                        Optical size correction. Marks differ in ink coverage, so equal boxes look
                        unequal. 1 is unscaled. The preview shows the result at the size the site
                        renders it.
                    </p>
                    {scaleOutOfRange && (
                        <p className="mt-1 text-sm text-amber-700">
                            Outside the usual {SCALE_MIN}–{SCALE_MAX} range. It is stored as typed.
                        </p>
                    )}
                </div>

                <ImageUploadField
                    label="Screenshot (optional)"
                    value={draft.screenshotUrl}
                    dir={SCREENSHOT_DIR}
                    owner={draft.name}
                    ownerLabel="project name"
                    onChange={(screenshotUrl) => update({ screenshotUrl })}
                />

                <ScreenshotCapture
                    url={draft.url}
                    sourceUrl={draft.screenshotSourceUrl}
                    onSourceUrlChange={(screenshotSourceUrl) => update({ screenshotSourceUrl })}
                    owner={draft.name}
                    light={draft.screenshotUrl}
                    dark={draft.screenshotUrlDark}
                    onCaptured={({ light, dark }) => update({
                        ...(light ? { screenshotUrl: light } : {}),
                        ...(dark ? { screenshotUrlDark: dark } : {}),
                    })}
                    onRemoveDark={() => update({ screenshotUrlDark: undefined })}
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

                <SkillsEditor
                    label="Skills (optional)"
                    skills={skills}
                    newSkill={newSkill}
                    onNewSkillChange={setNewSkill}
                    // Absent rather than [], so an emptied list leaves no "skills": [] in the JSON.
                    onChange={(next) => update({ skills: next.length > 0 ? next : undefined })}
                />
            </div>
        </EditorDialog>
    );
};

export default ProjectDialog;
