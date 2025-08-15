import { useState } from 'react';
import type { PersonalInfo } from "../types/props";
import { Edit, Eye } from 'lucide-react';

const PersonalInfoSection: React.FC<{
    personalInfo: PersonalInfo;
    onUpdate: (field: keyof PersonalInfo, value: string) => void;
}> = ({ personalInfo, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    
    return (
        <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold mb-4">Personal Information</h2>
            <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
            {isEditing ? <Eye className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
            {isEditing ? 'Preview' : 'Edit'}
            </button>
        </div>
        
        {isEditing ? (
            <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                type="text"
                value={personalInfo.name}
                onChange={(e) => onUpdate('name', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                type="text"
                value={personalInfo.title}
                onChange={(e) => onUpdate('title', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">About</label>
                <textarea
                value={personalInfo.about}
                onChange={(e) => onUpdate('about', e.target.value)}
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors resize-none"
                />
            </div>
            </div>
        ) : (
            <div>
            <h3 className="text-xl font-semibold">{personalInfo.name}</h3>
            <p className="text-gray-600">{personalInfo.title}</p>
            <p className="text-gray-700 mt-2">{personalInfo.about}</p>
            </div>
        )}
        </section>
    );
};

export default PersonalInfoSection;