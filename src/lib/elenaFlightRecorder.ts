// Flight recorder deferred — all exports are no-ops
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function recordFlightEvent(..._args: any[]) { /* no-op */ }
export function getSessionId() { return 'disabled'; }
export async function setFlightRecorderForUser(_userId: string, _enabled: boolean) { /* no-op */ }
