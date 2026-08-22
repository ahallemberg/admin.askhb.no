import type { Role } from '../../types/props';
import { splitParagraphs } from '../../func/text';
import { DEFAULT_LABEL } from '../../func/links';

/*
 * Mirrors askhb.no's src/components/RoleBlock.tsx. Restyling that file makes this
 * stale -- change both together.
 */
interface RolePreviewProps {
    role: Role;
    // Set when the employer owns more than one role. A nested title steps down to
    // the body face so the serif company name above stays the anchor of the entry.
    nested?: boolean;
}

/*
 * This app keeps the two link shapes in step on load, but a draft being typed has
 * not been through that: the role in hand is whatever the dialog currently holds.
 * So the same fallback the site applies is applied here, and an unlabelled link
 * gets the same default rather than previewing as a bare arrow.
 */
const previewLinks = (role: Role) => {
    const labelled = (role.links ?? [])
        .filter((link) => typeof link?.url === 'string' && link.url.trim() !== '')
        .map((link) => ({
            url: link.url,
            label: typeof link.label === 'string' && link.label.trim() !== '' ? link.label : DEFAULT_LABEL,
        }));

    if (labelled.length > 0) return labelled;
    return role.readMoreUrl ? [{ label: DEFAULT_LABEL, url: role.readMoreUrl }] : [];
};

const RolePreview: React.FC<RolePreviewProps> = ({ role, nested = false }) => {
    const links = previewLinks(role);
    const skills = role.skills ?? [];
    const paragraphs = splitParagraphs(role.description);

    return (
        <div>
            {/* A blank title previews as a placeholder rather than as an empty
                heading, so a half-filled draft reads as unfinished instead of
                broken. The site has no such case: it never renders a draft. */}
            <h4 className={nested ? 'text-[15px] font-semibold text-ink' : 'font-serif text-lg font-medium text-ink'}>
                {role.title || <span className="text-ink-faint italic">Untitled role</span>}
            </h4>

            {role.date && (
                <p className="mt-1 text-[11px] uppercase tracking-[0.13em] text-ink-faint">{role.date}</p>
            )}

            {paragraphs.map((paragraph, index) => (
                <p key={index} className={`leading-relaxed text-ink-muted ${index > 0 ? 'mt-3' : 'mt-2'}`}>
                    {paragraph}
                </p>
            ))}

            {role.result && (
                <div className="mt-3 border-t border-rule pt-2">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-accent">Result</div>
                    <div className="mt-1 font-serif text-base text-ink">{role.result}</div>
                </div>
            )}

            {/*
             * Rendered as text, not as anchors. On the site these navigate; in an
             * editor a stray click that throws away an unsaved draft is a real
             * cost and the destination is already shown, and checkable, in the
             * field beside this pane.
             */}
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

            {skills.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-x-2 gap-y-1.5 list-none">
                    {skills.map((skill, index) => (
                        <li key={index} className="rounded-[2px] bg-rule-faint px-2 py-[3px] text-[11.5px] text-ink-muted">
                            {skill}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default RolePreview;
