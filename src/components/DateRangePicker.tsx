import { useState } from "react";
import type { DateRange } from "../types/props";
import { MONTHS, yearOptions, pickerStateFromRange, rangeFromPickerState, isBackwards, type PickerState } from "../func/dates";

const SELECT_CLASS = "p-3 border border-rule rounded-lg focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors disabled:bg-rule-faint disabled:text-ink-faint";

const DateRangePicker: React.FC<{
    value: DateRange | undefined;
    fallbackText: string;
    onChange: (range: DateRange | null) => void;
}> = ({ value, fallbackText, onChange }) => {
    // Initialised once per mount. The parent dialog is remounted via a key each
    // time it opens, so there is no need to re-sync from the prop afterwards — and
    // not re-syncing is what lets a half-filled picker keep the end values the user
    // already chose while they flip the end mode back and forth. Note `value` is
    // therefore read non-reactively here but reactively further down, where it must
    // be for the warnings to clear as the picker fills in; that asymmetry is
    // deliberate, not an oversight.
    const [state, setState] = useState<PickerState>(() => pickerStateFromRange(value));

    const update = (patch: Partial<PickerState>) => {
        const next = { ...state, ...patch };
        setState(next);
        onChange(rangeFromPickerState(next));
    };

    const endDisabled = state.endMode !== 'date';

    // A stored year outside the offered range would set select.value to a value with
    // no matching <option>, which renders the select blank while the value is intact.
    // Fold any such year in rather than appearing to have lost it.
    const offeredYears = yearOptions();
    const storedYears = [state.startYear, state.endYear]
        .map(Number)
        .filter(year => year > 0 && !offeredYears.includes(year));
    const years = storedYears.length > 0
        ? [...new Set([...storedYears, ...offeredYears])].sort((a, b) => b - a)
        : offeredYears;

    const currentRange = rangeFromPickerState(state);
    const hasStoredDate = fallbackText.trim() !== '';
    // An existing date string the parser could not read. Shown so the user can see
    // what is currently stored before replacing it.
    const unparsed = !value && hasStoredDate;
    // The picker is half-filled, so nothing has been written yet. Without this the UI
    // silently contradicts itself: switch End mode to "Has an end date" without
    // choosing a year and the preview keeps showing the old value with no cue that
    // the change was discarded.
    const incomplete = currentRange === null && !unparsed && hasStoredDate;
    const backwards = currentRange !== null && isBackwards(currentRange);

    const monthSelect = (
        which: 'startMonth' | 'endMonth',
        disabled: boolean
    ) => (
        <select
            value={state[which]}
            disabled={disabled}
            onChange={(e) => update({ [which]: e.target.value })}
            className={SELECT_CLASS + " flex-1"}
        >
            <option value="">Month</option>
            {MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>{month}</option>
            ))}
        </select>
    );

    const yearSelect = (
        which: 'startYear' | 'endYear',
        disabled: boolean
    ) => (
        <select
            value={state[which]}
            disabled={disabled}
            onChange={(e) => update({ [which]: e.target.value })}
            className={SELECT_CLASS + " flex-1"}
        >
            <option value="">Year</option>
            {years.map(year => <option key={year} value={year}>{year}</option>)}
        </select>
    );

    return (
        <div>
            <label className="block text-sm font-medium text-ink-muted mb-2">Date</label>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <span className="block text-xs text-ink-faint mb-1">Start</span>
                    <div className="flex gap-2">
                        {monthSelect('startMonth', state.yearOnly)}
                        {yearSelect('startYear', false)}
                    </div>
                </div>

                <div>
                    <span className="block text-xs text-ink-faint mb-1">End</span>
                    <div className="flex gap-2">
                        {monthSelect('endMonth', endDisabled || state.yearOnly)}
                        {yearSelect('endYear', endDisabled)}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3">
                <select
                    value={state.endMode}
                    onChange={(e) => update({ endMode: e.target.value as PickerState['endMode'] })}
                    className={SELECT_CLASS + " py-2"}
                >
                    <option value="date">Has an end date</option>
                    <option value="ongoing">Ongoing (today)</option>
                    <option value="none">No end date</option>
                </select>

                <label className="flex items-center gap-2 text-sm text-ink-muted">
                    <input
                        type="checkbox"
                        checked={state.yearOnly}
                        onChange={(e) => update({ yearOnly: e.target.checked, startMonth: '', endMonth: '' })}
                    />
                    Year only
                </label>
            </div>

            {unparsed && (
                <p className="mt-2 text-sm text-amber-700">
                    Stored as “{fallbackText}”, which could not be read as a date. It stays as it is until you pick one above.
                </p>
            )}
            {incomplete && (
                <p className="mt-2 text-sm text-amber-700">
                    This date is incomplete, so it is still stored as “{fallbackText}”. Finish choosing above to change it.
                </p>
            )}
            {backwards && (
                <p className="mt-2 text-sm text-amber-700">
                    The end is earlier than the start.
                </p>
            )}
        </div>
    );
};

export default DateRangePicker;
