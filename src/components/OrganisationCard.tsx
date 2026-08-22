import type { Organisation, DragHandleProps } from "../types/props";
import { Edit, Trash2, GripVertical } from "lucide-react";

const OrganisationCard: React.FC<{
    organisation: Organisation;
    onEdit: () => void;
    onDelete: () => void;
    dragHandleProps?: DragHandleProps;
}> = ({ organisation, onEdit, onDelete, dragHandleProps }) => (
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

        <div className="ml-8">
            <div className="flex items-center gap-3">
                {organisation.logoUrl && (
                    <img src={organisation.logoUrl} alt="" className="w-8 h-8 object-contain" />
                )}
                <h3 className="text-xl font-semibold">{organisation.company}</h3>
            </div>
            <p className="text-gray-600">
                {[organisation.location, organisation.date, organisation.commitment].filter(Boolean).join(' | ')}
            </p>

            <ol className="mt-3 border-l-2 border-gray-200 pl-4">
                {organisation.roles.map((role, index) => (
                    <li key={index} className={index > 0 ? "mt-3" : undefined}>
                        <p className="font-semibold">{role.title}</p>
                        <p className="text-sm text-gray-500">{role.date}</p>
                        {role.result && (
                            <p className="text-sm text-gray-700 mt-1">Result: {role.result}</p>
                        )}
                        <div className="mt-1">
                            {role.skills.map((skill: string, skillIndex: number) => (
                                <span key={skillIndex} className="inline-block bg-gray-200 rounded-full px-3 py-1 text-xs font-semibold text-gray-700 mr-2 mb-2">
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </li>
                ))}
            </ol>
        </div>
    </div>
);

export default OrganisationCard;
