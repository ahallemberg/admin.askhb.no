import { useState } from "react";
import type { Organisation, Role } from "../types/props";
import { X, Plus } from "lucide-react";
import RoleEditor from "./RoleEditor";
import ImageUploadField from "./ImageUploadField";
import { deepEqual } from "../func/compare";
import { spanOf } from "../func/organisations";
import { formatDateRange } from "../func/dates";
import { LOGO_DIR } from "../constants/app";
import type { PublishedPage } from "../func/pages";

const FIELD_CLASS = "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors";

// The bounds offered by the logo scale input. Values outside them are still stored
// — nothing enforces an input's min/max — but they are called out, and the preview
// is clamped so it cannot blow the dialog's layout apart.
const SCALE_MIN = 0.5;
const SCALE_MAX = 2;

// Every role in the list needs a stable React key and `Role` has no id field: the
// JSON shape is a contract with askhb.no, so one cannot simply be added. `title` is
// no good either — two stints with the same title at one employer is exactly the
// shape this whole refactor exists to model.
//
// So keys are minted here and never leave the component. A module-level counter
// rather than a ref because it needs no hook ordering and stays unique across every
// dialog opened in the session; StrictMode's double-invoked initialiser merely burns
// a few numbers.
let nextRoleId = 0;
const freshId = () => `role-${nextRoleId++}`;

interface KeyedRole {
    id: string;
    role: Role;
}

const blankRole = (): Role => ({ title: '', date: '', description: '', skills: [] });

// The organisation's `date` is never typed: it is the span across its roles, the
// same discipline as date/dateRange one level down. spanOf ignores roles with no
// dateRange, so an organisation of nothing but unparsed dates falls back to the
// first role's stored string rather than blanking out.
const withDerivedDate = (next: Organisation): Organisation => {
    const span = spanOf(next.roles);
    return { ...next, date: span ? formatDateRange(span) : next.roles[0]?.date ?? '' };
};

const OrganisationDialog: React.FC<{
    organisation: Organisation;
    isOpen: boolean;
    isEditing: boolean;
    publishedPages: PublishedPage[];
    pagesLoadFailed: boolean;
    onClose: () => void;
    onSave: (organisation: Organisation) => void;
}> = ({ organisation, isOpen, isEditing, publishedPages, pagesLoadFailed, onClose, onSave }) => {
    // Split in two so the keyed role list is the single source of role order. Holding
    // roles inside the organisation object as well would leave two copies to keep in
    // step, and the stale one would eventually win.
    const [fields, setFields] = useState<Omit<Organisation, 'roles'>>({
        company: organisation.company,
        location: organisation.location,
        date: organisation.date,
        logoUrl: organisation.logoUrl,
        logoScale: organisation.logoScale,
        commitment: organisation.commitment
    });
    const [roles, setRoles] = useState<KeyedRole[]>(() =>
        organisation.roles.map(role => ({ id: freshId(), role }))
    );
    // Half-typed skills, by role id. Lifted out of RoleEditor so handleClose can see
    // them; a skill typed but not added lives only here and closing would drop it.
    const [newSkills, setNewSkills] = useState<Record<string, string>>({});

    const current: Organisation = { ...fields, roles: roles.map(entry => entry.role) };
    const derived = withDerivedDate(current);

    const updateRole = (id: string, role: Role) =>
        setRoles(prev => prev.map(entry => entry.id === id ? { ...entry, role } : entry));

    const moveRole = (id: string, delta: number) =>
        setRoles(prev => {
            const index = prev.findIndex(entry => entry.id === id);
            const target = index + delta;
            if (index === -1 || target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });

    const removeRole = (id: string) => {
        setRoles(prev => prev.filter(entry => entry.id !== id));
        // Otherwise a skill draft belonging to a role that no longer exists keeps the
        // dialog looking dirty for good.
        setNewSkills(prev => {
            if (!(id in prev)) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const addRole = () => {
        // Minted outside the updater: StrictMode invokes updaters twice, and an id
        // generated in there would advance the counter for a value React discards.
        const entry: KeyedRole = { id: freshId(), role: blankRole() };
        setRoles(prev => [...prev, entry]);
    };

    // Closing discards the draft outright, so confirm first when there is one.
    // Compared against `current` rather than `derived`: an organisation whose stored
    // date disagrees with its roles would otherwise prompt on an untouched dialog.
    const handleClose = () => {
        const hasDraft = !deepEqual(current, organisation)
            || Object.values(newSkills).some(value => value.trim() !== '');
        if (hasDraft && !window.confirm('Discard changes to this organisation?')) {
            return;
        }
        onClose();
    };

    if (!isOpen) return null;

    const scale = fields.logoScale;
    const scaleOutOfRange = scale !== undefined && (scale < SCALE_MIN || scale > SCALE_MAX);
    const previewScale = Math.min(Math.max(scale ?? 1, SCALE_MIN), SCALE_MAX);

    return (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-900">
                        {isEditing ? 'Edit' : 'Add'} Organisation
                    </h3>
                    <button
                        onClick={handleClose}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                                <input
                                    type="text"
                                    value={fields.company}
                                    onChange={(e) => setFields(prev => ({ ...prev, company: e.target.value }))}
                                    className={FIELD_CLASS}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Location (optional)</label>
                                <input
                                    type="text"
                                    value={fields.location ?? ''}
                                    onChange={(e) => setFields(prev => ({ ...prev, location: e.target.value === '' ? undefined : e.target.value }))}
                                    className={FIELD_CLASS}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Commitment (optional)</label>
                            <input
                                type="text"
                                value={fields.commitment ?? ''}
                                onChange={(e) => setFields(prev => ({ ...prev, commitment: e.target.value === '' ? undefined : e.target.value }))}
                                className={FIELD_CLASS}
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                e.g. "Volunteer, 25+ hrs/week". Renders beside the date span.
                            </p>
                        </div>

                        <div>
                            <span className="block text-sm font-medium text-gray-700 mb-2">Date</span>
                            <p className="p-3 border border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                                {derived.date || <span className="text-gray-400">Set by the roles below</span>}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                Derived from the roles — earliest start to latest end — and not editable here.
                                Change a role's date to change it.
                            </p>
                        </div>

                        <ImageUploadField
                            label="Logo (optional)"
                            value={fields.logoUrl}
                            dir={LOGO_DIR}
                            onChange={(logoUrl) => setFields(prev => ({ ...prev, logoUrl }))}
                        />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Logo scale (optional)</label>
                            <input
                                type="number"
                                step="0.05"
                                min={SCALE_MIN}
                                max={SCALE_MAX}
                                value={scale ?? ''}
                                onChange={(e) => {
                                    // A type=number input reads back '' for anything it
                                    // cannot parse, and Number('') is 0 — which would
                                    // scale the mark out of existence. Store nothing
                                    // instead, and never let a NaN reach the JSON.
                                    const parsed = Number(e.target.value);
                                    const next = e.target.value === '' || !Number.isFinite(parsed) ? undefined : parsed;
                                    setFields(prev => ({ ...prev, logoScale: next }));
                                }}
                                className={FIELD_CLASS}
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Optical size correction. Marks differ in ink coverage, so equal boxes look
                                unequal. 1 is unscaled.
                            </p>
                            {scaleOutOfRange && (
                                <p className="mt-1 text-sm text-amber-700">
                                    Outside the usual {SCALE_MIN}–{SCALE_MAX} range. It is stored as typed, but the
                                    preview below is clamped.
                                </p>
                            )}

                            {fields.logoUrl && (
                                <div className="mt-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Scale preview</p>
                                    <div className="flex items-center gap-3 border border-dashed border-gray-300 rounded-lg p-4 bg-gray-100">
                                        <div className="w-12 h-12 shrink-0 flex items-center justify-center border border-gray-300 rounded bg-white overflow-hidden">
                                            <img
                                                src={fields.logoUrl}
                                                alt=""
                                                className="max-w-full max-h-full object-contain"
                                                style={{ transform: `scale(${previewScale})` }}
                                            />
                                        </div>
                                        <span className="text-xl font-semibold text-gray-900 truncate">
                                            {fields.company || 'Company'}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">
                                        Approximate: askhb.no's logo slot need not be this size. The correction is a
                                        ratio, though, so a mark tuned to sit right against the heading here sits
                                        right there too.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className="block text-sm font-medium text-gray-700">Roles</label>
                            <button
                                type="button"
                                onClick={addRole}
                                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add role
                            </button>
                        </div>

                        {roles.length === 0 && (
                            <p className="text-sm text-amber-700">
                                No roles. An organisation with none renders nothing at all on askhb.no —
                                add one before saving.
                            </p>
                        )}

                        <div className="space-y-4">
                            {roles.map((entry, index) => (
                                <RoleEditor
                                    key={entry.id}
                                    role={entry.role}
                                    index={index}
                                    total={roles.length}
                                    newSkill={newSkills[entry.id] ?? ''}
                                    publishedPages={publishedPages}
                                    pagesLoadFailed={pagesLoadFailed}
                                    canRemove={roles.length > 1}
                                    onChange={(role) => updateRole(entry.id, role)}
                                    onNewSkillChange={(value) => setNewSkills(prev => ({ ...prev, [entry.id]: value }))}
                                    onMove={(delta) => moveRole(entry.id, delta)}
                                    onRemove={() => removeRole(entry.id)}
                                />
                            ))}
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
                            onSave(derived);
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

export default OrganisationDialog;
