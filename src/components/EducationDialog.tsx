import { useState, useEffect } from 'react';
import type { EducationItem } from "../types/props";
import { X, Trash2} from 'lucide-react';

const EducationDialog: React.FC<{
    education: EducationItem;
    isOpen: boolean;
    isEditing: boolean;
    onClose: () => void;
    onSave: (education: EducationItem) => void;
}> = ({ education, isOpen, isEditing, onClose, onSave }) => {
    const [tempItem, setTempItem] = useState(education);
    
    useEffect(() => {
        setTempItem(education);
    }, [education]);
    
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
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-900">
                        {isEditing ? 'Edit' : 'Add'} Education
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Degree</label>
                        <input
                        type="text"
                        value={tempItem.degree}
                        onChange={(e) => setTempItem(prev => ({ ...prev, degree: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Institution</label>
                        <input
                        type="text"
                        value={tempItem.institution}
                        onChange={(e) => setTempItem(prev => ({ ...prev, institution: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                        <input
                        type="text"
                        placeholder="e.g., Aug. 2023 - today"
                        value={tempItem.date}
                        onChange={(e) => setTempItem(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
                        />
                    </div>
                    
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className="block text-sm font-medium text-gray-700">Description</label>
                            <button
                            onClick={addDescription}
                            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
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
                                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
                                    />
                                    <button
                                    onClick={() => removeDescription(index)}
                                    className="p-3 text-gray-400 hover:text-red-600 transition-colors"
                                    >
                                    <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onSave(tempItem);
                            onClose();
                        }}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                        >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EducationDialog;