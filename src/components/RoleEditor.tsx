import type { Role, DateRange, PortfolioLink } from "../types/props";
import { X, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import DateRangePicker from "./DateRangePicker";
import LinksEditor from "./LinksEditor";
import { deriveReadMoreUrl } from "../func/links";
import type { PublishedPage } from "../func/pages";
import { formatDateRange } from "../func/dates";

const FIELD_CLASS = "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors";
const ICON_BUTTON_CLASS = "p-2 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors";

// One role inside an organisation — the old single-entry experience form minus
// `company`, which has moved up to the organisation, plus `result`.
//
// Fully controlled, including the half-typed skill: a skill entered but not yet
// added lives nowhere else, so the dialog holds it in order to notice it when the
// user closes without saving. Keeping it local here would lose that guard.
const RoleEditor: React.FC<{
    role: Role;
    index: number;
    total: number;
    newSkill: string;
    publishedPages: PublishedPage[];
    pagesLoadFailed: boolean;
    canRemove: boolean;
    onChange: (role: Role) => void;
    onNewSkillChange: (value: string) => void;
    onMove: (delta: number) => void;
    onRemove: () => void;
}> = ({
    role,
    index,
    total,
    newSkill,
    publishedPages,
    pagesLoadFailed,
    canRemove,
    onChange,
    onNewSkillChange,
    onMove,
    onRemove
}) => {
    // dateRange is the source of truth; `date` is derived from it so the two cannot
    // disagree. A null range means the picker is still incomplete — leave the
    // existing date alone rather than clearing it.
    const handleDateChange = (range: DateRange | null) => {
        if (!range) return;
        onChange({ ...role, dateRange: range, date: formatDateRange(range) });
    };

    // links is the source of truth; readMoreUrl is derived from the first one so an
    // askhb.no build that predates multi-link support still renders something.
    const handleLinksChange = (links: PortfolioLink[]) => {
        onChange({ ...role, links, readMoreUrl: deriveReadMoreUrl(links) });
    };

    const addSkill = () => {
        if (newSkill && !role.skills.includes(newSkill)) {
            onChange({ ...role, skills: [...role.skills, newSkill] });
            onNewSkillChange('');
        }
    };

    const removeSkill = (skillIndex: number) => {
        onChange({ ...role, skills: role.skills.filter((_, i) => i !== skillIndex) });
    };

    return (
        <div className="border border-gray-200 rounded-lg">
            <div className="flex justify-between items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                <span className="text-sm font-semibold text-gray-700 truncate">
                    Role {index + 1}
                    {role.title.trim() !== '' && (
                        <span className="font-normal text-gray-500"> — {role.title}</span>
                    )}
                </span>
                <div className="flex shrink-0">
                    <button
                        type="button"
                        onClick={() => onMove(-1)}
                        disabled={index === 0}
                        title="Move up"
                        className={ICON_BUTTON_CLASS}
                    >
                        <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onMove(1)}
                        disabled={index === total - 1}
                        title="Move down"
                        className={ICON_BUTTON_CLASS}
                    >
                        <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onRemove}
                        disabled={!canRemove}
                        // An organisation with no roles renders nothing at all on
                        // askhb.no, so the last one cannot be taken away.
                        title={canRemove ? 'Remove role' : 'An organisation needs at least one role'}
                        className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                    <input
                        type="text"
                        value={role.title}
                        onChange={(e) => onChange({ ...role, title: e.target.value })}
                        className={FIELD_CLASS}
                    />
                </div>

                <DateRangePicker
                    value={role.dateRange}
                    fallbackText={role.date}
                    onChange={handleDateChange}
                />

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                        value={role.description}
                        onChange={(e) => onChange({ ...role, description: e.target.value })}
                        rows={6}
                        className={FIELD_CLASS + " resize-none"}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Result (optional)</label>
                    <input
                        type="text"
                        value={role.result ?? ''}
                        // Stored absent rather than empty, so a cleared field leaves no
                        // "result": "" behind in the JSON for askhb.no to render.
                        onChange={(e) => onChange({ ...role, result: e.target.value === '' ? undefined : e.target.value })}
                        className={FIELD_CLASS}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        The outcome, stated plainly — e.g. "2× more shelters found, at higher precision".
                        Rendered as a ruled "Result" line. Leave empty if there is no clean headline
                        number; the layout closes up.
                    </p>
                </div>

                <LinksEditor
                    links={role.links ?? []}
                    pages={publishedPages}
                    pagesLoadFailed={pagesLoadFailed}
                    onChange={handleLinksChange}
                />

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Skills</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {role.skills.map((skill, skillIndex) => (
                            <span
                                key={skillIndex}
                                // inline-flex, not the `inline-block … flex` pair the old
                                // dialog carried: those are two values for `display` and
                                // which one wins is down to stylesheet order.
                                className="inline-flex items-center gap-2 bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2"
                            >
                                {skill}
                                <button
                                    type="button"
                                    onClick={() => removeSkill(skillIndex)}
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
                            onChange={(e) => onNewSkillChange(e.target.value)}
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
        </div>
    );
};

export default RoleEditor;
