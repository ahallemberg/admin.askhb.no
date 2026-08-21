import type { ExperienceItem } from "../types/props";

// Mirrors askhb.no's src/components/ExperienceItem.tsx, minus the FadeIn wrapper
// and its dark: classes (this app has no dark mode), plus an 'Untitled' placeholder
// so a fresh Add dialog does not preview an empty heading. Restyling the portfolio
// card will make this preview stale — update both together.
const ExperiencePreview: React.FC<{ experience: ExperienceItem }> = ({ experience }) => (
    <div>
        <h3 className="text-xl font-semibold">{experience.title || 'Untitled'}</h3>
        <p className="text-gray-600">{experience.company} | {experience.date}</p>
        <p className="mt-2 text-gray-700">{experience.description}</p>
        {experience.readMoreUrl && (
            <span className="inline-block mt-2 text-blue-600 text-sm">Read more →</span>
        )}
        <div className="mt-2">
            {experience.skills.map((skill, index) => (
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

export default ExperiencePreview;
