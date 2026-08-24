import type { Organisation, DragHandleProps, Role } from "../types/props";
import { normaliseLinks } from "../func/links";
import { Edit, Trash2, GripVertical } from "lucide-react";

// A role carries either shape: `links` since multi-link support, or a lone
// `readMoreUrl` from before it. normaliseLinks backfills one from the other and
// drops empty urls, so the markup below has a single path and can never emit an
// anchor without a href or a label.
const roleLinks = (role: Role) => normaliseLinks(role).links ?? [];

const OrganisationCard: React.FC<{
    organisation: Organisation;
    onEdit: () => void;
    onDelete: () => void;
    dragHandleProps?: DragHandleProps;
}> = ({ organisation, onEdit, onDelete, dragHandleProps }) => (
    <div className="mb-6 group relative bg-paper rounded-lg p-6 shadow-sm border border-rule hover:shadow-md transition-shadow">
        <div
            {...dragHandleProps}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
        >
            <GripVertical className="w-5 h-5 text-ink-faint hover:text-ink-muted" />
        </div>

        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="p-2 text-ink-faint hover:text-ink-muted transition-colors rounded-lg hover:bg-rule-faint" title="Edit">
                <Edit className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-2 text-ink-faint hover:text-red-600 transition-colors rounded-lg hover:bg-red-50" title="Delete">
                <Trash2 className="w-4 h-4" />
            </button>
        </div>

        <div className="ml-8">
            <div className="flex items-center gap-3">
                {organisation.logoUrl && (
                    <img src={organisation.logoUrl} alt="" className="w-8 h-8 object-contain" />
                )}
                <h3 className="text-xl font-semibold">{organisation.company}</h3>
            </div>
            <p className="text-ink-muted">
                {[organisation.location, organisation.date, organisation.commitment].filter(Boolean).join(' | ')}
            </p>

            <ol className="mt-3 border-l-2 border-rule pl-4">
                {organisation.roles.map((role, index) => {
                    const links = roleLinks(role);

                    return (
                        <li key={index} className={index > 0 ? "mt-3" : undefined}>
                            <h4 className="font-semibold">{role.title}</h4>
                            <p className="text-sm text-ink-faint">{role.date}</p>
                            {role.result && (
                                <p className="text-sm text-ink-muted mt-1">Result: {role.result}</p>
                            )}
                            {links.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-x-4">
                                    {links.map((link, linkIndex) => (
                                        <a
                                            key={linkIndex}
                                            href={link.url}
                                            target="_blank"
                                            // These can point anywhere now, not only at pages.askhb.no.
                                            rel="noreferrer"
                                            className="text-accent hover:text-ink text-sm transition-colors"
                                        >
                                            {link.label} →
                                        </a>
                                    ))}
                                </div>
                            )}
                            <div className="mt-1">
                                {role.skills.map((skill: string, skillIndex: number) => (
                                    <span key={skillIndex} className="inline-block bg-rule rounded-full px-3 py-1 text-xs font-semibold text-ink-muted mr-2 mb-2">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    </div>
);

export default OrganisationCard;
