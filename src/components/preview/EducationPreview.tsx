import type { EducationItem } from '../../types/props';

/*
 * Mirrors askhb.no's src/components/EducationItem.tsx. Restyling that file makes
 * this stale -- change both together.
 *
 * The version this replaces mirrored the site as it looked before the editorial
 * redesign, and went on previewing that after the page had moved on. A preview
 * that no longer matches is worse than none: it is confidently wrong.
 */

/*
 * The site lifts a GPA line out of the description and into a right-hand rail.
 * Reproduced here because it is not a styling detail but a rule about what the
 * author types: the pattern is anchored and demands the literal colon, so
 * "GPA: 4,79/5" is lifted and "Graduated with a GPA of 4,79/5" is not. Seeing
 * which one happened is the whole reason to preview this section.
 */
const GPA_LINE = /^GPA:\s*(\S.*?)\s*$/i;

// Only the first match is lifted; a second stays where it is and renders as an
// ordinary line, rather than vanishing.
const partitionDescription = (lines: string[]) => {
    let gpa: string | undefined;
    const rest: string[] = [];

    for (const line of lines) {
        const match = gpa === undefined ? GPA_LINE.exec(line) : null;
        if (match) {
            gpa = match[1];
        } else {
            rest.push(line);
        }
    }

    return { gpa, rest };
};

const EducationPreview: React.FC<{ education: EducationItem }> = ({ education }) => {
    const { gpa, rest } = partitionDescription(Array.isArray(education.description) ? education.description : []);
    const meta = [education.institution, education.date].filter(Boolean).join(' · ');

    return (
        /*
         * Without the hairline the site draws between entries: it separates one
         * entry from the next, and the site drops it on the last one. A single
         * previewed entry is always the last one.
         */
        <article className="flex flex-col sm:flex-row sm:items-start sm:gap-8">
            {/* Narrowable, so a long elective-course line wraps inside the column
                instead of pushing the rail off the entry. */}
            <div className="min-w-0 flex-1">
                <h3 className="font-serif text-base font-semibold text-ink">
                    {education.degree || <span className="text-ink-faint italic">Untitled degree</span>}
                </h3>

                {meta && (
                    <p className="mt-1 text-[11px] uppercase tracking-[0.13em] text-ink-faint">{meta}</p>
                )}

                {rest.map((line, index) => (
                    <p key={index} className="mt-2 leading-relaxed text-ink-muted">{line}</p>
                ))}
            </div>

            {/* Omitted outright when there is no GPA rather than reserved as an
                empty box, so an entry without one ends at its description. */}
            {gpa && (
                <div className="mt-3 shrink-0 break-words sm:mt-0 sm:max-w-[10rem] sm:pt-0.5 sm:text-right">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-ink-muted">GPA</div>
                    <div className="mt-1 font-serif text-base text-ink">{gpa}</div>
                </div>
            )}
        </article>
    );
};

export default EducationPreview;
