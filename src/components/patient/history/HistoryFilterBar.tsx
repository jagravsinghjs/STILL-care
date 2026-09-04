/**
 * STILL-care History Filter Bar
 *
 * Provides simple, low-friction filtering:
 * - Mode filter: All, Written, Voice
 * - Date range: All time, Past 7 days, Past 30 days
 *
 * Keeps the interface unhurried and clear without complex dashboard filters.
 */

import React from 'react';
import { Filter, Calendar } from 'lucide-react';

export type ModeFilterType = 'all' | 'text' | 'voice';
export type DateRangeFilterType = 'all' | '7days' | '30days';

interface HistoryFilterBarProps {
  modeFilter: ModeFilterType;
  onChangeModeFilter: (mode: ModeFilterType) => void;
  dateFilter: DateRangeFilterType;
  onChangeDateFilter: (range: DateRangeFilterType) => void;
  totalCount: number;
}

export function HistoryFilterBar({
  modeFilter,
  onChangeModeFilter,
  dateFilter,
  onChangeDateFilter,
  totalCount
}: HistoryFilterBarProps) {
  return (
    <div
      id="history-filter-bar"
      className="p-3.5 bg-paper-grey/50 border border-charcoal/15 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
    >
      {/* Mode Filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-charcoal/60 font-medium mr-1 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
          <span>Format:</span>
        </span>

        <button
          type="button"
          id="filter-mode-all"
          onClick={() => onChangeModeFilter('all')}
          className={`px-3 py-1.5 rounded transition-colors font-medium min-h-[36px] ${
            modeFilter === 'all'
              ? 'bg-charcoal text-bone shadow-xs'
              : 'bg-bone text-charcoal/70 border border-charcoal/15 hover:text-charcoal hover:bg-paper-grey'
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/30`}
        >
          All modes
        </button>

        <button
          type="button"
          id="filter-mode-written"
          onClick={() => onChangeModeFilter('text')}
          className={`px-3 py-1.5 rounded transition-colors font-medium min-h-[36px] ${
            modeFilter === 'text'
              ? 'bg-charcoal text-bone shadow-xs'
              : 'bg-bone text-charcoal/70 border border-charcoal/15 hover:text-charcoal hover:bg-paper-grey'
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/30`}
        >
          Written only
        </button>

        <button
          type="button"
          id="filter-mode-voice"
          onClick={() => onChangeModeFilter('voice')}
          className={`px-3 py-1.5 rounded transition-colors font-medium min-h-[36px] ${
            modeFilter === 'voice'
              ? 'bg-charcoal text-bone shadow-xs'
              : 'bg-bone text-charcoal/70 border border-charcoal/15 hover:text-charcoal hover:bg-paper-grey'
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/30`}
        >
          Voice only
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="flex items-center gap-2 self-start sm:self-center">
        <label htmlFor="history-date-filter" className="text-charcoal/60 font-medium flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
          <span>Period:</span>
        </label>
        <select
          id="history-date-filter"
          value={dateFilter}
          onChange={(e) => onChangeDateFilter(e.target.value as DateRangeFilterType)}
          className="bg-bone text-charcoal text-xs rounded border border-charcoal/20 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-charcoal/30 min-h-[36px]"
        >
          <option value="all">All time</option>
          <option value="7days">Past 7 days</option>
          <option value="30days">Past 30 days</option>
        </select>

        <span className="text-[11px] text-charcoal/50 pl-1">
          ({totalCount} record{totalCount === 1 ? '' : 's'})
        </span>
      </div>
    </div>
  );
}
