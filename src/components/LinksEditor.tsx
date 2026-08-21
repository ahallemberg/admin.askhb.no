import { Plus, X, ChevronUp, ChevronDown } from "lucide-react";
import type { PortfolioLink } from "../types/props";
import type { PublishedPage } from "../func/pages";
import { DEFAULT_LABEL } from "../func/links";

const FIELD_CLASS = "p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors";
const CUSTOM = '__custom__';

const LinksEditor: React.FC<{
    links: PortfolioLink[];
    pages: PublishedPage[];
    pagesLoadFailed: boolean;
    onChange: (links: PortfolioLink[]) => void;
}> = ({ links, pages, pagesLoadFailed, onChange }) => {
    const replace = (index: number, link: PortfolioLink) =>
        onChange(links.map((existing, i) => i === index ? link : existing));

    const move = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= links.length) return;
        const next = [...links];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Links (optional)</label>
                <button
                    type="button"
                    onClick={() => onChange([...links, { label: DEFAULT_LABEL, url: '' }])}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add link
                </button>
            </div>

            {links.length === 0 && (
                <p className="text-sm text-gray-500">No links. The entry renders without a “Read more” line.</p>
            )}

            <div className="space-y-3">
                {links.map((link, index) => {
                    // A URL the page index doesn't know is simply a custom one now that
                    // arbitrary URLs are allowed — no "not found" claim to get wrong.
                    const matched = pages.find(page => page.url === link.url);
                    const selection = matched ? matched.url : CUSTOM;

                    return (
                        <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={link.label}
                                    placeholder="Label"
                                    onChange={(e) => replace(index, { ...link, label: e.target.value })}
                                    className={FIELD_CLASS + " w-32 shrink-0"}
                                />
                                <select
                                    value={selection}
                                    onChange={(e) => replace(index, {
                                        ...link,
                                        url: e.target.value === CUSTOM ? '' : e.target.value
                                    })}
                                    className={FIELD_CLASS + " flex-1 min-w-0"}
                                >
                                    <option value={CUSTOM}>Custom URL…</option>
                                    {pages.map(page => (
                                        <option key={page.slug} value={page.url}>{page.title}</option>
                                    ))}
                                </select>
                                <div className="flex shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => move(index, -1)}
                                        disabled={index === 0}
                                        title="Move up"
                                        className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                                    >
                                        <ChevronUp className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => move(index, 1)}
                                        disabled={index === links.length - 1}
                                        title="Move down"
                                        className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                                    >
                                        <ChevronDown className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onChange(links.filter((_, i) => i !== index))}
                                        title="Remove link"
                                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {selection === CUSTOM && (
                                <input
                                    type="url"
                                    value={link.url}
                                    placeholder="https://github.com/…"
                                    onChange={(e) => replace(index, { ...link, url: e.target.value })}
                                    className={FIELD_CLASS + " w-full"}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {pagesLoadFailed && (
                <p className="mt-2 text-sm text-amber-700">
                    Could not load the published pages from pages.askhb.no, so only custom URLs are offered.
                </p>
            )}
            {links.length > 1 && (
                <p className="mt-2 text-xs text-gray-500">
                    The first link is also written to <code>readMoreUrl</code>, which is what an askhb.no build without multi-link support shows.
                </p>
            )}
        </div>
    );
};

export default LinksEditor;
