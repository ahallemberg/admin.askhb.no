import type { EducationItem } from "../types/props";
import { Edit, Trash2} from "lucide-react";

const EducationCard: React.FC<{
    education: EducationItem;
    onEdit: () => void;
    onDelete: () => void;
}> = ({ education, onEdit, onDelete }) => (
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
        
        {/* Content matching EducationItem.tsx exactly */}
        <h3 className="text-xl font-semibold">{education.degree}</h3>
        <p className="text-gray-600">{education.institution} | {education.date}</p>
        <div className="mt-2 text-gray-700">
        {education.description.map((line: string, index: number) => (
            <p key={index} className={index > 0 ? "mt-1" : ""}>{line}</p>
        ))}
        </div>
    </div>
);

export default EducationCard;