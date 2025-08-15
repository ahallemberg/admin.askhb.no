import type { ExperienceItem } from "../types/props";
import { Edit, Trash2 } from "lucide-react";

const ExperienceCard: React.FC<{
    experience: ExperienceItem;
    onEdit: () => void;
    onDelete: () => void;
}> = ({ experience, onEdit, onDelete }) => (
    <div className="mb-6 group relative">
        {/* Action buttons - hidden by default, shown on hover */}
        <div className="absolute top-0 right-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Edit"
        >
            <Edit className="w-4 h-4" />
        </button>
        <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete"
        >
            <Trash2 className="w-4 h-4" />
        </button>
        </div>
        
        {/* Content matching ExperienceItem.tsx exactly */}
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
);

export default ExperienceCard;