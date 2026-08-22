import type { PersonalInfo } from "../types/props";
import { Edit } from "lucide-react";
import { splitParagraphs } from "../func/text";
import { R2_PROFILE_PICTURE } from "../constants/app";

/*
 * The same card the other sections list, for the one entry this section has.
 *
 * No drag handle and no delete: there is exactly one personal info object and it
 * cannot be reordered or removed. The content keeps the indent the draggable
 * cards need for their handle even though there is nothing to make room for --
 * without it this card's content would start a handle's width to the left of
 * every card below it, which is visible straight down the page.
 */
const PersonalInfoCard: React.FC<{
    personalInfo: PersonalInfo;
    onEdit: () => void;
}> = ({ personalInfo, onEdit }) => (
    <div className="mb-6 group relative bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
                onClick={onEdit}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                title="Edit"
            >
                <Edit className="w-4 h-4" />
            </button>
        </div>

        <div className="ml-8 flex gap-4">
            {/*
             * Always rendered, unlike a logo or a screenshot: the site's header
             * has no state without a photo, and the stored URL and the constant
             * address the same object. Which one is used matters anyway -- the
             * stored one carries the cache buster, so a photo replaced a minute
             * ago shows here rather than whatever the browser cached.
             *
             * Contained rather than cropped or stretched, so a photo that is
             * not square letterboxes into the box here. The preview inside the
             * dialog deliberately does not do that: the site fixes both
             * dimensions and no fit, so a non-square photo really is squashed
             * there, and showing that is the preview's job.
             */}
            <img
                src={personalInfo.profilePictureUrl || R2_PROFILE_PICTURE}
                alt=""
                className="w-20 h-20 shrink-0 object-contain rounded border border-gray-200"
            />

            <div className="min-w-0">
                <h3 className="text-xl font-semibold">{personalInfo.name}</h3>
                <p className="text-gray-600">{personalInfo.title}</p>
                {/* Split the way the site splits it, so a card showing one block
                    of text is telling you the paragraph break did not take. */}
                <div className="mt-2 text-gray-700">
                    {splitParagraphs(personalInfo.about).map((paragraph, index) => (
                        <p key={index} className={index > 0 ? "mt-2" : undefined}>{paragraph}</p>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

export default PersonalInfoCard;
