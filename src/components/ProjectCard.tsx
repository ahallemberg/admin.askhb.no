import type { ProjectItem, DragHandleProps } from "../types/props";
import { Edit, Trash2, GripVertical } from "lucide-react";

const ProjectCard: React.FC<{
    project: ProjectItem;
    onEdit: () => void;
    onDelete: () => void;
    dragHandleProps?: DragHandleProps;
}> = ({ project, onEdit, onDelete, dragHandleProps }) => (
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

        <div className="ml-8 flex gap-4">
            {project.screenshotUrl && (
                <img
                    src={project.screenshotUrl}
                    alt=""
                    className="w-28 h-20 shrink-0 object-cover rounded border border-rule"
                />
            )}

            <div className="min-w-0">
                <h3 className="text-xl font-semibold">{project.name}</h3>

                {/* Shown rather than hidden behind the dialog for the same reason a role's
                    links are: a wrong url fails silently everywhere else, so the list is
                    the only place anyone would catch it. */}
                {project.url && (
                    <a
                        href={project.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:text-ink text-sm transition-colors break-all"
                    >
                        {project.url}
                    </a>
                )}

                <p className="mt-2 text-ink-muted">{project.description}</p>

                {project.figure && (
                    <p className="mt-2 text-ink">
                        <span className="text-lg font-semibold">{project.figure}</span>
                        {project.figureCaption && (
                            <span className="ml-2 text-sm text-ink-faint">{project.figureCaption}</span>
                        )}
                    </p>
                )}

                {/* skills is optional on a project, unlike a role's, so it can be absent
                    entirely rather than an empty array. */}
                {project.skills && project.skills.length > 0 && (
                    <div className="mt-2">
                        {project.skills.map((skill: string, index: number) => (
                            <span
                                key={index}
                                className="inline-block bg-rule rounded-full px-3 py-1 text-xs font-semibold text-ink-muted mr-2 mb-2"
                            >
                                {skill}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
);

export default ProjectCard;
