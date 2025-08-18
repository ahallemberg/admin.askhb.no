import type { EducationItem } from "../types/props";
import { Edit, Trash2, GripVertical } from "lucide-react";

const EducationCard: React.FC<{
    education: EducationItem;
    onEdit: () => void;
    onDelete: () => void;
    dragHandleProps?: any;
}> = ({ education, onEdit, onDelete, dragHandleProps }) => (
    <div className="mb-6 group relative bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
        {/* Drag handle */}
        <div
            {...dragHandleProps}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
        >
            <GripVertical className="w-5 h-5 text-gray-400 hover:text-gray-600" />
        </div>

        {/* Action buttons - hidden by default, shown on hover */}
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
                onClick={onEdit}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                title="Edit"
            >
                <Edit className="w-4 h-4" />
            </button>
            <button
                onClick={onDelete}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                title="Delete"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
        
        {/* Content - with left margin for drag handle */}
        <div className="ml-8">
            <h3 className="text-xl font-semibold">{education.degree}</h3>
            <p className="text-gray-600">{education.institution} | {education.date}</p>
            <div className="mt-2 text-gray-700">
                {education.description.map((line: string, index: number) => (
                    <p key={index} className={index > 0 ? "mt-1" : ""}>{line}</p>
                ))}
            </div>
        </div>
    </div>
);

export default EducationCard;