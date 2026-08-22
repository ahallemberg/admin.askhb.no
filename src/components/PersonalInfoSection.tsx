import type { PersonalInfo } from "../types/props";
import PersonalInfoPreview from "./preview/PersonalInfoPreview";
import PreviewSurface from "./preview/PreviewSurface";

const FIELD_CLASS = "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors";

/*
 * Fields and preview side by side above the large breakpoint, stacked below it —
 * the arrangement the entry dialogs use, so the whole editor behaves one way.
 *
 * This section used to toggle between editing and previewing, which meant the
 * only view that showed the effect of a change was the one you had to leave to
 * make it. About is the field that most needs a preview and the one that made
 * the toggle worst: its paragraph breaks only become visible once rendered.
 */
const PersonalInfoSection: React.FC<{
    personalInfo: PersonalInfo;
    onUpdate: (field: keyof PersonalInfo, value: string) => void;
}> = ({ personalInfo, onUpdate }) => (
    <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Personal Information</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                    <input
                        type="text"
                        value={personalInfo.name}
                        onChange={(e) => onUpdate('name', e.target.value)}
                        className={FIELD_CLASS}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                        type="text"
                        value={personalInfo.title}
                        onChange={(e) => onUpdate('title', e.target.value)}
                        className={FIELD_CLASS}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">About</label>
                    <textarea
                        value={personalInfo.about}
                        onChange={(e) => onUpdate('about', e.target.value)}
                        rows={10}
                        className={FIELD_CLASS + " resize-y"}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        A blank line starts a new paragraph. A single line break does not — it renders as a space.
                    </p>
                </div>
            </div>

            {/* Bordered like the dialogs' pane, which is a full-height column of
                its own; here the section sits in the page flow, so the surface is
                given a height to fill instead. */}
            <div className="h-[38rem] rounded-lg border border-gray-200 bg-gray-50">
                <PreviewSurface note="The profile photo comes from the bucket and the social icons from the site's own repo; neither is edited here, and the icon row is left out.">
                    <PersonalInfoPreview personalInfo={personalInfo} />
                </PreviewSurface>
            </div>
        </div>
    </section>
);

export default PersonalInfoSection;
