import type { Organisation } from '../../types/props';
import LogoMark from './LogoMark';
import RolePreview from './RolePreview';

/*
 * Mirrors askhb.no's src/components/OrganisationItem.tsx. Restyling that file
 * makes this stale -- change both together.
 */
const OrganisationPreview: React.FC<{ organisation: Organisation }> = ({ organisation }) => {
    const roles = organisation.roles ?? [];

    /*
     * The site drops the organisation's own span whenever it is an exact copy of
     * the first role's, so a single-role employer does not print the same dates
     * twice. The dialog derives that span from the roles, so this is the common
     * case here rather than an edge one -- previewing the date unconditionally
     * would show a duplicated line the page will not have.
     */
    const showDate = roles.length === 0 || roles[0].date !== organisation.date;

    const meta = [
        organisation.location,
        showDate ? organisation.date : undefined,
        organisation.commitment,
    ].filter(Boolean).join(' · ');

    return (
        <article>
            <header className="flex items-center gap-3">
                <LogoMark url={organisation.logoUrl} scale={organisation.logoScale} />
                <div>
                    <h3 className="font-serif text-xl font-semibold text-ink">
                        {organisation.company || <span className="text-ink-faint italic">Untitled organisation</span>}
                    </h3>
                    {meta && (
                        <p className="mt-1 text-[11px] uppercase tracking-[0.13em] text-ink-faint">{meta}</p>
                    )}
                </div>
            </header>

            {/*
             * The single-role branch renders flat and the multi-role branch nests
             * behind a rail. Both are reproduced because which one an entry gets
             * changes as roles are added, and that change is exactly what an
             * author wants to see before saving.
             */}
            {roles.length === 1 && (
                <div className="mt-3">
                    <RolePreview role={roles[0]} nested={false} />
                </div>
            )}

            {roles.length > 1 && (
                <div className="mt-4 border-l-2 border-rule pl-4">
                    {roles.map((role, index) => (
                        <div key={index} className={index > 0 ? 'mt-6' : undefined}>
                            <RolePreview role={role} nested />
                        </div>
                    ))}
                </div>
            )}

            {/* Not a styling choice being mirrored but a warning: the site renders
                a header with nothing under it, which is why the dialog objects to
                saving in this state. */}
            {roles.length === 0 && (
                <p className="mt-3 text-[13px] italic text-ink-faint">No roles &mdash; this entry renders as a bare heading.</p>
            )}
        </article>
    );
};

export default OrganisationPreview;
