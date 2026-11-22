// Display bands for the persisted Module 11 mean score (0–100).
// Reuses 40/65 boundaries from Module 13; does NOT calculate risk or alter alerts.
export const DISTRESS_BANDS = { lowMax: 40, moderateMax: 65 } as const;
export function distressStatus(score: number | null) {
  if (score === null || !Number.isFinite(score) || score < 0 || score > 100) return { tone: 'unknown', label: 'Not assessed' };
  if (score <= DISTRESS_BANDS.lowMax) return { tone: 'low', label: 'Low distress' };
  if (score <= DISTRESS_BANDS.moderateMax) return { tone: 'moderate', label: 'Moderate distress' };
  return { tone: 'high', label: 'High distress' };
}
export const sessionDate = (iso: string) => new Intl.DateTimeFormat(undefined, {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(iso));
