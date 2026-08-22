import { Download } from 'lucide-react';
import type { PersonalInfo } from '../../types/props';
import { splitParagraphs } from '../../func/text';
import { R2_PROFILE_PICTURE } from '../../constants/app';

/*
 * Mirrors the header and About section of askhb.no's src/pages/Portfolio.tsx.
 * Restyling that page makes this stale -- change both together.
 *
 * The row of social icons the site puts between the title and the CV button is
 * left out. Those live in a JSON file committed to the site's repo, not in R2,
 * so nothing here can read them; duplicating the list would add a fourth place
 * to edit when a link is added, to a change that already needs three. The note
 * under the pane says so, since the gap is otherwise unexplained.
 */
const PersonalInfoPreview: React.FC<{ personalInfo: PersonalInfo }> = ({ personalInfo }) => {
    const about = splitParagraphs(personalInfo.about);

    return (
        <div>
            <header className="pb-10 text-center">
                {/* The draft's URL when a photo has just been uploaded, so this
                    shows the new one rather than whatever the browser cached for
                    the bare key. */}
                <img
                    src={personalInfo.profilePictureUrl || R2_PROFILE_PICTURE}
                    alt=""
                    className="w-26 h-26 mx-auto mb-5"
                />

                <h1 className="font-serif text-4xl font-medium tracking-tight text-ink">
                    {personalInfo.name || <span className="text-ink-faint italic">Your name</span>}
                </h1>
                <p className="mt-2 text-lg text-ink-faint">{personalInfo.title}</p>

                {/*
                 * Rendered only when the field is set, exactly as on the site --
                 * which is the point of previewing it. The button is what tells
                 * you a CV upload actually landed, and the site cannot check for
                 * itself whether one exists.
                 */}
                {personalInfo.cvUrl && (
                    <span className="border-rule text-ink-muted mt-6 inline-flex items-center gap-2 rounded-[2px] border px-4 py-2">
                        <Download size={16} />
                        <span className="text-[13px] font-medium">Download CV</span>
                    </span>
                )}
            </header>

            <section>
                <h2 className="font-serif text-[11.5px] font-medium uppercase tracking-[0.2em] text-accent border-b border-rule pb-2 mb-6">
                    About
                </h2>
                {about.map((paragraph, index) => (
                    <p key={index} className={`text-ink-muted leading-relaxed ${index > 0 ? 'mt-4' : ''}`}>
                        {paragraph}
                    </p>
                ))}
            </section>
        </div>
    );
};

export default PersonalInfoPreview;
