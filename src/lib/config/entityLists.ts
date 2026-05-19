// Single source of truth for NYC place names used across entity extraction and chip routing.
// Previously duplicated across getUXContextState.ts, topicDetect.ts, and topicChipPacks.ts
// with slight divergence (15 vs 17 entries). Consolidated here as the full set.
export const NYC_PLACE_NAMES: string[] = [
  'Nueva York', 'New York', 'NYC', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx',
  'Midtown', 'Downtown', 'SoHo', 'Tribeca', 'Chelsea', 'Harlem',
  'Central Park', 'Times Square', 'Wall Street', 'Fifth Avenue',
];
