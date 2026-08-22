import type { ProjectItem } from '../../types/props';

/*
 * Mirrors askhb.no's src/components/ProjectItem.tsx. Restyling that file makes
 * this stale -- change both together.
 *
 * One deliberate departure: the site wraps the whole card in an anchor when the
 * project has a url. Here the card is never a link. A click that navigates away
 * from a dialog holding an unsaved draft loses the draft, and the url is already
 * shown as text in the field beside this pane, which is the better place to
 * check it anyway.
 */
const CARD_CLASS = 'flex h-full flex-col overflow-hidden rounded-[3px] border border-rule bg-rule-faint';

const ProjectPreview: React.FC<{ project: ProjectItem }> = ({ project }) => {
    const skills = project.skills ?? [];
    const name = typeof project.name === 'string' ? project.name.trim() : '';

    // Best-effort, exactly as on the site: a malformed url loses its printed
    // hostname rather than throwing.
    const host = (() => {
        if (!project.url) return undefined;
        try {
            return new URL(project.url).hostname.replace(/^www\./, '');
        } catch {
            return undefined;
        }
    })();

    // Printed only when it says something the name does not, which is also the
    // only case where it works as a check on a wrong url.
    const showHost = host !== undefined && host.toLowerCase() !== name.toLowerCase();

    return (
        /*
         * The site lays these out two to a row above the small breakpoint, so the
         * card is capped near half the reading measure rather than filling the
         * pane. A card previewed at full width would wrap its description at
         * roughly twice the real line length.
         */
        <div className="max-w-[17rem]">
            <div className={CARD_CLASS}>
                {project.screenshotUrl && (
                    <img
                        src={project.screenshotUrl}
                        alt=""
                        className="aspect-[16/10] w-full border-b border-rule object-cover object-top"
                    />
                )}

                <div className="flex flex-1 flex-col p-5">
                    {name
                        ? <h3 className="font-serif text-lg font-semibold text-ink">{name}</h3>
                        : <h3 className="font-serif text-lg font-semibold text-ink-faint italic">Untitled project</h3>}

                    <p className="mt-2 leading-relaxed text-ink-muted">{project.description}</p>

                    {/* Paper rather than the faint rule fill the page chips take:
                        on this card that fill is the card, so those chips would
                        vanish into it. */}
                    {skills.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-x-2 gap-y-1.5 list-none">
                            {skills.map((skill, index) => (
                                <li key={index} className="rounded-[2px] bg-paper px-2 py-[3px] text-[11.5px] text-ink-muted">
                                    {skill}
                                </li>
                            ))}
                        </ul>
                    )}

                    {(project.figure || project.url) && (
                        <div className="mt-auto">
                            {/* Gated on the figure alone, so a caption saved without
                                one is dropped rather than printed as a stray label
                                -- which is what the dialog's warning is about. */}
                            {project.figure && (
                                <div className="mt-4 border-t border-rule pt-3">
                                    <div className="font-serif text-2xl leading-none text-accent">{project.figure}</div>
                                    {project.figureCaption && (
                                        <div className="mt-1.5 text-[10px] uppercase tracking-[0.13em] text-ink-muted">
                                            {project.figureCaption}
                                        </div>
                                    )}
                                </div>
                            )}

                            {project.url && (
                                <div className="mt-4 text-[13px] text-accent">
                                    {showHost ? host : 'Visit'} <span aria-hidden="true">&rarr;</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectPreview;
