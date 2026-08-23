import { parseInline, type Segment } from '../../func/richtext';

/*
 * Mirrors askhb.no's src/components/RichText.tsx. Restyling that file makes this
 * stale -- change both together.
 *
 * One deliberate departure, the same one this pane already makes everywhere else:
 * links are rendered as text, not as anchors. RolePreview does it for its link row
 * and ProjectPreview leaves its card inert, for the reason that applies here too
 * -- a click that navigates away from a dialog holding an unsaved draft destroys
 * the draft, and the destination is readable in the field beside this pane.
 *
 * The styling is the site's, so what is previewed is what will ship: accent with
 * an underline rather than accent alone, because colour against body copy is
 * nowhere near the contrast WCAG 1.4.1 asks of a link cue.
 */
const LINK_CLASS = 'text-accent underline decoration-1 underline-offset-2';

const renderSegments = (segments: Segment[]): React.ReactNode =>
    segments.map((segment, index) => {
        switch (segment.kind) {
            case 'text':
                return segment.value;
            case 'strong':
                return (
                    <strong key={index} className="font-semibold text-ink">
                        {renderSegments(segment.children)}
                    </strong>
                );
            case 'em':
                return (
                    <em key={index} className="italic">
                        {renderSegments(segment.children)}
                    </em>
                );
            case 'link':
                return (
                    <span key={index} className={LINK_CLASS}>
                        {renderSegments(segment.children)}
                    </span>
                );
        }
    });

const RichTextPreview: React.FC<{ text?: string }> = ({ text }) => <>{renderSegments(parseInline(text))}</>;

export default RichTextPreview;
