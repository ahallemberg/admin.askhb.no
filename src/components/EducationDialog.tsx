import { useState } from 'react';
import type { EducationItem, DateRange } from "../types/props";
import { Trash2 } from 'lucide-react';
import EditorDialog from "./EditorDialog";
import EducationPreview from "./preview/EducationPreview";
import PreviewSurface from "./preview/PreviewSurface";
import { deepEqual } from "../func/compare";
import DateRangePicker from "./DateRangePicker";
import { formatDateRange } from "../func/dates";

const FIELD_CLASS = "w-full p-3 border border-rule rounded-lg focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors";

const EducationDialog: React.FC<{
    education: EducationItem;
    isOpen: boolean;
    isEditing: boolean;
    onClose: () => void;
    onSave: (education: EducationItem) => void;
}> = ({ education, isOpen, isEditing, onClose, onSave }) => {
    const [tempItem, setTempItem] = useState(education);

    // dateRange is the source of truth; `date` is derived from it so the two cannot
    // disagree. A null range means the picker is still incomplete — leave the
    // existing date alone rather than clearing it.
    const handleDateChange = (range: DateRange | null) => {
        if (!range) return;
        setTempItem(prev => ({ ...prev, dateRange: range, date: formatDateRange(range) }));
    };

    const addDescription = () => {
        setTempItem(prev => ({
            ...prev,
            description: [...prev.description, '']
        }));
    };
    
    const updateDescription = (index: number, value: string) => {
        setTempItem(prev => ({
            ...prev,
            description: prev.description.map((desc, i) => i === index ? value : desc)
        }));
    };
    
    const removeDescription = (index: number) => {
        setTempItem(prev => ({
            ...prev,
            description: prev.description.filter((_, i) => i !== index)
        }));
    };
    
    // Closing discards the draft outright, so confirm first when there is one.
    const handleClose = () => {
        if (!deepEqual(tempItem, education) && !window.confirm('Discard changes to this entry?')) {
            return;
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <EditorDialog
            title={`${isEditing ? 'Edit' : 'Add'} Education`}
            isOpen={isOpen}
            onClose={handleClose}
            onSave={() => {
                onSave(tempItem);
                onClose();
            }}
            preview={
                <PreviewSurface>
                    <EducationPreview education={tempItem} />
                </PreviewSurface>
            }
        >
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-ink-muted mb-2">Degree</label>
                    <input
                        type="text"
                        value={tempItem.degree}
                        onChange={(e) => setTempItem(prev => ({ ...prev, degree: e.target.value }))}
                        className={FIELD_CLASS}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-ink-muted mb-2">Institution</label>
                    <input
                        type="text"
                        value={tempItem.institution}
                        onChange={(e) => setTempItem(prev => ({ ...prev, institution: e.target.value }))}
                        className={FIELD_CLASS}
                    />
                </div>
                <DateRangePicker
                    value={tempItem.dateRange}
                    fallbackText={tempItem.date}
                    onChange={handleDateChange}
                />

                <div>
                    <div className="flex justify-between items-center mb-3">
                        <label className="block text-sm font-medium text-ink-muted">Description</label>
                        <button
                            onClick={addDescription}
                            className="text-sm text-ink-muted hover:text-ink transition-colors"
                        >
                            + Add Item
                        </button>
                    </div>
                    <div className="space-y-3">
                        {tempItem.description.map((desc, index) => (
                            <div key={index} className="flex gap-2">
                                <input
                                    type="text"
                                    value={desc}
                                    onChange={(e) => updateDescription(index, e.target.value)}
                                    placeholder="Description item"
                                    className={`flex-1 ${FIELD_CLASS}`}
                                />
                                <button
                                    onClick={() => removeDescription(index)}
                                    className="p-3 text-ink-faint hover:text-red-600 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                    {/* The site lifts a line matching this shape into a labelled
                        rail beside the entry. Said here because the pattern is
                        strict and the preview is the only other place it shows. */}
                    <p className="mt-2 text-xs text-ink-faint">
                        A line written exactly as "GPA: 4,79/5" is pulled out and rendered on its own. Supports [text](https://example.com), **bold** and *italic*.
                    </p>
                </div>
            </div>
        </EditorDialog>
    );
};

export default EducationDialog;