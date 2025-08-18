import type { ExperienceItem } from "../types/props";
import { Edit, Trash2, GripVertical } from "lucide-react";

const ExperienceCard: React.FC<{
    experience: ExperienceItem;
    onEdit: () => void;
    onDelete: () => void;
    dragHandleProps?: any;
}> = ({ experience, onEdit, onDelete, dragHandleProps}) => (
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
            <h3 className="text-xl font-semibold">{experience.title}</h3>
            <p className="text-gray-600">{experience.company} | {experience.date}</p>
            <p className="mt-2 text-gray-700">{experience.description}</p>
            {experience.readMoreUrl && (
                <a 
                    href={experience.readMoreUrl} 
                    target="_blank" 
                    className="inline-block mt-2 text-blue-600 hover:text-blue-800 text-sm transition-colors"
                >
                    Read more →
                </a>
            )}
            <div className="mt-2">
                {experience.skills.map((skill: string, index: number) => (
                    <span 
                        key={index} 
                        className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2"
                    >
                        {skill}
                    </span>
                ))}
            </div>
        </div>
    </div>
);

export default ExperienceCard;