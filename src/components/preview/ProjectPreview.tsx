import type { ProjectItem } from '../../types/props';
import { DEFAULT_LABEL } from '../../func/links';
import LogoMark from './LogoMark';
import RichTextPreview from './RichTextPreview';

/*
 * Mirrors askhb.no's src/components/ProjectItem.tsx. Restyling that file makes
 * this stale -- change both together.
 *
 * One deliberate departure: on the site the card is clickable as a whole -- the
 * name carries the link and stretches a pseudo-element across the card -- while
 * here the card is never a link at all. A click that navigates away from a dialog
 * holding an unsaved draft loses the draft, and the url is already shown as text
 * in the field beside this pane, which is the better place to check it anyway.
 *
 * That is also why none of the stretched-link machinery is mirrored: without an
 * anchor there is nothing to stretch, and nothing in the description to lift
 * clear of it.
 */
const CARD_CLASS = 'flex h-full flex-col rounded-[3px] border border-rule bg-rule-faint';

/*
 * Same defaulting RolePreview does, and for the same reason: the project in hand
 * is whatever the dialog currently holds, so a link typed without a label yet
 * previews under the default rather than as a bare arrow.
 */
const previewLinks = (project: ProjectItem) =>
    (project.links ?? [])
        .filter((link) => typeof link?.url === 'string' && link.url.trim() !== '')
        .map((link) => ({
            url: link.url,
            label: typeof link.label === 'string' && link.label.trim() !== '' ? link.label : DEFAULT_LABEL,
        }));

const ProjectPreview: React.FC<{ project: ProjectItem }> = ({ project }) => {
    const links = previewLinks(project);
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
                        className="aspect-[16/10] w-full rounded-t-[2px] border-b border-rule object-cover object-top"
                    />
                )}

                <div className="flex flex-1 flex-col p-5">
                    {/*
                     * The mark groups with the heading exactly as it does on the
                     * site and on an organisation. LogoMark renders nothing when
                     * there is no url, so a project without a logo keeps the flush
                     * left heading it has today.
                     */}
                    <div className="flex items-center gap-3">
                        <LogoMark url={project.logoUrl} scale={project.logoScale} />
                        {name
                            ? <h3 className="min-w-0 font-serif text-lg font-semibold text-ink">{name}</h3>
                            : <h3 className="min-w-0 font-serif text-lg font-semibold text-ink-muted italic">Untitled project</h3>}
                    </div>

                    <p className="mt-2 leading-relaxed text-ink-muted">
                        <RichTextPreview text={project.description} />
                    </p>

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

                    {/* Spans, not anchors, like every other link in this pane: a
                        click that navigates away from a dialog holding an unsaved
                        draft destroys the draft. */}
                    {links.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                            {links.map((link, index) => (
                                <span
                                    key={index}
                                    className="text-[13px] text-accent underline decoration-1 underline-offset-4"
                                >
                                    {link.label} <span aria-hidden="true">&rarr;</span>
                                </span>
                            ))}
                        </div>
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
