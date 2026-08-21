import type { PublishedPage } from "../func/pages";

const SELECT_CLASS = "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors disabled:bg-gray-100 disabled:text-gray-500";

const ReadMoreUrlSelect: React.FC<{
    value: string | undefined;
    pages: PublishedPage[];
    loadFailed: boolean;
    onChange: (url: string | undefined) => void;
}> = ({ value, pages, loadFailed, onChange }) => {
    // A stored URL the index does not know about: a renamed or unpublished page, or
    // a legacy askhb.no/... link. It is offered as a selectable option so that
    // opening and saving an entry can never silently clear a working link.
    const isKnown = !value || pages.some(page => page.url === value);

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Read More URL (optional)</label>
            <select
                value={value ?? ''}
                disabled={loadFailed}
                onChange={(e) => onChange(e.target.value || undefined)}
                className={SELECT_CLASS}
            >
                <option value="">None</option>
                {!isKnown && <option value={value}>⚠ Not found: {value}</option>}
                {pages.map(page => (
                    <option key={page.slug} value={page.url}>{page.title}</option>
                ))}
            </select>

            {loadFailed && (
                <p className="mt-2 text-sm text-amber-700">
                    Could not load the published pages from pages.askhb.no, so this field is locked to its current value.
                </p>
            )}
            {!loadFailed && !isKnown && (
                <p className="mt-2 text-sm text-amber-700">
                    This URL is not a published page. Pick one from the list, or leave it if the page is not published yet.
                </p>
            )}
        </div>
    );
};

export default ReadMoreUrlSelect;
