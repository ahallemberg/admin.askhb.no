import type { PublishedPage } from "../func/pages";

const SELECT_CLASS = "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors disabled:bg-gray-100 disabled:text-gray-500";

const ReadMoreUrlSelect: React.FC<{
    value: string | undefined;
    pages: PublishedPage[];
    loadFailed: boolean;
    loading: boolean;
    onChange: (url: string | undefined) => void;
}> = ({ value, pages, loadFailed, loading, onChange }) => {
    // Whether the index contains this URL is a three-valued question — present,
    // absent, or not known yet — and answering it with one boolean is what makes a
    // valid link read as unpublished while the fetch is still in flight. Only claim
    // "not found" once the index has actually been consulted.
    const indexKnown = !loading && !loadFailed;
    const isUnlisted = !!value && !pages.some(page => page.url === value);
    const isMissing = indexKnown && isUnlisted;

    return (
        <div>
            <label htmlFor="read-more-url" className="block text-sm font-medium text-gray-700 mb-2">Read More URL (optional)</label>
            <select
                id="read-more-url"
                value={value ?? ''}
                disabled={!indexKnown}
                onChange={(e) => onChange(e.target.value || undefined)}
                className={SELECT_CLASS}
            >
                <option value="">None</option>
                {/* Keeps an unrecognised stored URL selectable rather than letting the
                    control fall back to None, so opening and saving an entry can never
                    silently clear a working link. */}
                {isUnlisted && (
                    <option value={value}>{isMissing ? `⚠ Not found: ${value}` : value}</option>
                )}
                {pages.map(page => (
                    <option key={page.slug} value={page.url}>{page.title}</option>
                ))}
            </select>

            {loading && (
                <p className="mt-2 text-sm text-gray-500">Loading published pages from pages.askhb.no…</p>
            )}
            {loadFailed && (
                <p className="mt-2 text-sm text-amber-700">
                    Could not load the published pages from pages.askhb.no, so this field is locked to its current value.
                </p>
            )}
            {isMissing && (
                <p className="mt-2 text-sm text-amber-700">
                    This URL is not a published page. Pick one from the list, or leave it if the page is not published yet.
                </p>
            )}
        </div>
    );
};

export default ReadMoreUrlSelect;
