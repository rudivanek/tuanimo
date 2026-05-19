import { getFreshAccessToken } from './api';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function trackEvent(eventName: string, props?: Record<string, unknown>): void {
  (async () => {
    try {
      const accessToken = await getFreshAccessToken();
      if (!accessToken) return;
      const res = await fetch(`${FUNCTIONS_URL}/analytics-event`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event_name: eventName, props: props ?? {} }),
      });
      if (!res.ok) {
        console.debug('[analytics-event] failed', { status: res.status, eventName });
      }
    } catch (err) {
      console.debug('[analytics-event] error', { eventName, err });
    }
  })();
}
