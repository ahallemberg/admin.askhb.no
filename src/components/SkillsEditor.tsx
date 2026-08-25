import { useState } from "react";
import { X } from "lucide-react";

const FIELD_CLASS = "w-full p-3 border border-rule rounded-lg focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors";

// The one skills editor, shared by RoleEditor and ProjectDialog — the two copies
// it replaced had already drifted on chip spacing. Chips reorder by drag, the
// same interaction the section cards get from DraggableList; that component is
// not reused here because it is built for a vertical list of block rows, and
// chips wrap, so the insert side has to come from the pointer's horizontal
// position against the hovered chip.
//
// The half-typed skill stays controlled from the dialog: a value typed but not
// yet added lives nowhere else, and the dialog needs it to notice an unsaved
// draft when closing.
const SkillsEditor: React.FC<{
    label: string;
    skills: string[];
    newSkill: string;
    onNewSkillChange: (value: string) => void;
    onChange: (skills: string[]) => void;
}> = ({ label, skills, newSkill, onNewSkillChange, onChange }) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [dropSide, setDropSide] = useState<'before' | 'after'>('after');

    const addSkill = () => {
        if (newSkill && !skills.includes(newSkill)) {
            onChange([...skills, newSkill]);
            onNewSkillChange('');
        }
    };

    const removeSkill = (index: number) => {
        onChange(skills.filter((_, i) => i !== index));
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // Firefox will not start a drag without data attached.
        e.dataTransfer.setData('text/plain', '');
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedIndex !== null && draggedIndex !== index) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setDragOverIndex(index);
            setDropSide(e.clientX < rect.left + rect.width / 2 ? 'before' : 'after');
        }
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== dropIndex) {
            const next = [...skills];
            const [dragged] = next.splice(draggedIndex, 1);
            let insertIndex = dropIndex;
            if (draggedIndex < dropIndex) insertIndex -= 1;
            if (dropSide === 'after') insertIndex += 1;
            next.splice(insertIndex, 0, dragged);
            onChange(next);
        }
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    return (
        <div>
            <label className="block text-sm font-medium text-ink-muted mb-3">{label}</label>
            <div className="flex flex-wrap gap-2 mb-3">
                {skills.map((skill, index) => (
                    <span
                        key={index}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        title="Drag to reorder"
                        className={`inline-flex items-center gap-2 bg-rule rounded-full px-3 py-1 text-sm font-semibold text-ink-muted cursor-grab
                            ${draggedIndex === index ? 'opacity-50' : ''}
                            ${dragOverIndex === index && dropSide === 'before' ? 'border-l-4 border-accent' : ''}
                            ${dragOverIndex === index && dropSide === 'after' ? 'border-r-4 border-accent' : ''}`}
                    >
                        {skill}
                        <button
                            type="button"
                            onClick={() => removeSkill(index)}
                            className="text-ink-faint hover:text-red-600 transition-colors"
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
                    className={`flex-1 ${FIELD_CLASS}`}
                />
                <button
                    type="button"
                    onClick={addSkill}
                    className="px-4 py-3 bg-ink text-paper rounded-lg hover:bg-ink-muted transition-colors"
                >
                    Add
                </button>
            </div>
        </div>
    );
};

export default SkillsEditor;
