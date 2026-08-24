import type { EducationItem, DragHandleProps } from "../types/props";
import { Edit, Trash2, GripVertical } from "lucide-react";

const EducationCard: React.FC<{
    education: EducationItem;
    onEdit: () => void;
    onDelete: () => void;
    dragHandleProps?: DragHandleProps;
}> = ({ education, onEdit, onDelete, dragHandleProps }) => (
    <div className="mb-6 group relative bg-paper rounded-lg p-6 shadow-sm border border-rule hover:shadow-md transition-shadow">
        {/* Drag handle */}
        <div
            {...dragHandleProps}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
        >
            <GripVertical className="w-5 h-5 text-ink-faint hover:text-ink-muted" />
        </div>

        {/* Action buttons - hidden by default, shown on hover */}
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
                onClick={onEdit}
                className="p-2 text-ink-faint hover:text-ink-muted transition-colors rounded-lg hover:bg-rule-faint"
                title="Edit"
            >
                <Edit className="w-4 h-4" />
            </button>
            <button
                onClick={onDelete}
                className="p-2 text-ink-faint hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                title="Delete"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
        
        {/* Content - with left margin for drag handle */}
        <div className="ml-8">
            <h3 className="text-xl font-semibold">{education.degree}</h3>
            <p className="text-ink-muted">{education.institution} | {education.date}</p>
            <div className="mt-2 text-ink-muted">
                {education.description.map((line: string, index: number) => (
                    <p key={index} className={index > 0 ? "mt-1" : ""}>{line}</p>
                ))}
            </div>
        </div>
    </div>
);

export default EducationCard;