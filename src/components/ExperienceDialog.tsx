import { useState, useEffect } from "react";
import type { ExperienceItem } from "../types/props";
import { X } from "lucide-react";

const ExperienceDialog: React.FC<{
    experience: ExperienceItem;
    isOpen: boolean;
    isEditing: boolean;
    onClose: () => void;
    onSave: (experience: ExperienceItem) => void;
}> = ({ experience, isOpen, isEditing, onClose, onSave }) => {
    const [tempItem, setTempItem] = useState(experience);
    const [newSkill, setNewSkill] = useState('');
    
    useEffect(() => {
        setTempItem(experience);
    }, [experience]);
    
    const addSkill = () => {
        if (newSkill && !tempItem.skills.includes(newSkill)) {
            setTempItem(prev => ({
                ...prev,
                skills: [...prev.skills, newSkill]
            }));
            setNewSkill('');
        }
    };
    
    const removeSkill = (index: number) => {
        setTempItem(prev => ({
            ...prev,
            skills: prev.skills.filter((_, i) => i !== index)
        }));
    };
    
    if (!isOpen) return null;
    
    return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Edit' : 'Add'} Experience
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
            <input
              type="text"
              value={tempItem.title}
              onChange={(e) => setTempItem(prev => ({ ...prev, title: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
            <input
              type="text"
              value={tempItem.company}
              onChange={(e) => setTempItem(prev => ({ ...prev, company: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="text"
              placeholder="e.g., Apr. 2024 - today"
              value={tempItem.date}
              onChange={(e) => setTempItem(prev => ({ ...prev, date: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={tempItem.description}
              onChange={(e) => setTempItem(prev => ({ ...prev, description: e.target.value }))}
              rows={6}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors resize-none"
            />
          </div>

        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Read More URL (optional)</label>
            <input
              type="url"
              placeholder="https://pages.askhb.no/my-experience"
              value={tempItem.readMoreUrl || ''}
              onChange={(e) => setTempItem(prev => ({ ...prev, readMoreUrl: e.target.value || undefined }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Skills</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {tempItem.skills.map((skill, index) => (
                <span
                  key={index}
                  className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2 flex items-center gap-2"
                >
                  {skill}
                  <button
                    onClick={() => removeSkill(index)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
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
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
              />
              <button
                onClick={addSkill}
                className="px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Add
              </button>
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

export default ExperienceDialog;