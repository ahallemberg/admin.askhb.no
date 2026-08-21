import type { EducationItem } from "../types/props";

// Mirrors askhb.no's src/components/EducationItem.tsx, minus the FadeIn wrapper
// and its dark: classes (this app has no dark mode), plus an 'Untitled' placeholder
// so a fresh Add dialog does not preview an empty heading. Restyling the portfolio
// card will make this preview stale — update both together.
const EducationPreview: React.FC<{ education: EducationItem }> = ({ education }) => (
    <div>
        <h3 className="text-xl font-semibold">{education.degree || 'Untitled'}</h3>
        <p className="text-gray-600">{education.institution} | {education.date}</p>
        <div className="mt-2 text-gray-700">
            {education.description.map((line, index) => (
                <p key={index} className={index > 0 ? "mt-1" : ""}>{line}</p>
            ))}
        </div>
    </div>
);

export default EducationPreview;
