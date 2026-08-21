import { useState } from "react";
import type { DateRange } from "../types/props";
import { MONTHS, yearOptions, pickerStateFromRange, rangeFromPickerState, type PickerState } from "../func/dates";

const SELECT_CLASS = "p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors disabled:bg-gray-100 disabled:text-gray-400";

const DateRangePicker: React.FC<{
    value: DateRange | undefined;
    fallbackText: string;
    onChange: (range: DateRange | null) => void;
}> = ({ value, fallbackText, onChange }) => {
    // Initialised once per mount. The parent dialog is remounted via a key each
    // time it opens, so there is no need to re-sync from the prop afterwards —
    // and not re-syncing is what lets a half-filled picker keep the end values
    // the user already chose while they flip the end mode back and forth.
    const [state, setState] = useState<PickerState>(() => pickerStateFromRange(value));

    const update = (patch: Partial<PickerState>) => {
        const next = { ...state, ...patch };
        setState(next);
        onChange(rangeFromPickerState(next));
    };

    const years = yearOptions();
    const endDisabled = state.endMode !== 'date';
    // An existing date string the parser could not read. Shown so the user can see
    // what is currently stored before replacing it.
    const unparsed = !value && fallbackText.trim() !== '';

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
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <span className="block text-xs text-gray-500 mb-1">Start</span>
                    <div className="flex gap-2">
                        {monthSelect('startMonth', state.yearOnly)}
                        {yearSelect('startYear', false)}
                    </div>
                </div>

                <div>
                    <span className="block text-xs text-gray-500 mb-1">End</span>
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

                <label className="flex items-center gap-2 text-sm text-gray-700">
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
        </div>
    );
};

export default DateRangePicker;
