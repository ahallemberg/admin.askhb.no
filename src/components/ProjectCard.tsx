import type { ProjectItem, DragHandleProps } from "../types/props";
import { Edit, Trash2, GripVertical } from "lucide-react";

const ProjectCard: React.FC<{
    project: ProjectItem;
    onEdit: () => void;
    onDelete: () => void;
    dragHandleProps?: DragHandleProps;
}> = ({ project, onEdit, onDelete, dragHandleProps }) => (
    <div className="mb-6 group relative bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
        <div
            {...dragHandleProps}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
        >
            <GripVertical className="w-5 h-5 text-gray-400 hover:text-gray-600" />
        </div>

        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100" title="Edit">
                <Edit className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50" title="Delete">
                <Trash2 className="w-4 h-4" />
            </button>
        </div>

        <div className="ml-8 flex gap-4">
            {project.screenshotUrl && (
                <img
                    src={project.screenshotUrl}
                    alt=""
                    className="w-28 h-20 shrink-0 object-cover rounded border border-gray-200"
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
                        className="text-blue-600 hover:text-blue-800 text-sm transition-colors break-all"
                    >
                        {project.url}
                    </a>
                )}

                <p className="mt-2 text-gray-700">{project.description}</p>

                {project.figure && (
                    <p className="mt-2 text-gray-900">
                        <span className="text-lg font-semibold">{project.figure}</span>
                        {project.figureCaption && (
                            <span className="ml-2 text-sm text-gray-500">{project.figureCaption}</span>
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
                                className="inline-block bg-gray-200 rounded-full px-3 py-1 text-xs font-semibold text-gray-700 mr-2 mb-2"
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
