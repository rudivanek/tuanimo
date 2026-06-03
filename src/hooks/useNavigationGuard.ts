/**
 * useNavigationGuard
 *
 * Protects against accidental navigation away from a page with unsaved work.
 * Two layers:
 *   1. `beforeunload` — fires when the user closes the tab, refreshes, or navigates
 *      to an external URL.  The browser shows its own native "Leave page?" dialog.
 *   2. History API patch — intercepts wouter's History-API-based SPA navigation
 *      (clicks on the bottom nav, Link components) and stores the intended
 *      destination so the caller can show a custom in-app confirmation modal.
 *
 * Usage:
 *   const { pendingPath, confirmNavigation, cancelNavigation } = useNavigationGuard(isDirty);
 *
 *   • `pendingPath`      — non-null when the user tried to navigate away; show
 *                          your confirmation modal when this is set.
 *   • `confirmNavigation()` — call when the user confirms "Yes, leave"; navigates
 *                             to the stored destination.
 *   • `cancelNavigation()`  — call when the user cancels; clears pendingPath.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'wouter';

export function useNavigationGuard(isDirty: boolean) {
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const isDirtyRef = useRef(isDirty);
  const ignoringRef = useRef(false); // set true right before we allow navigation through

  // Keep ref in sync so the event listeners always see the current value
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // ── Layer 1: beforeunload (tab close / refresh / external nav) ──────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      // Modern browsers show a generic message; setting returnValue is legacy but
      // still required by some browsers to actually show the dialog.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ── Layer 2: History API patch (wouter SPA navigation) ─────────────────────
  useEffect(() => {
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    // Intercept pushState (wouter uses this for Link clicks and useLocation setter)
    history.pushState = function (state, title, url) {
      if (!isDirtyRef.current || ignoringRef.current || url == null) {
        return originalPushState(state, title, url);
      }
      // Determine the path from the URL
      const path = typeof url === 'string'
        ? url.startsWith('http') ? new URL(url).pathname : url
        : String(url);

      // Same-page navigation (e.g. query-string changes on the same route): let through
      const currentPath = window.location.pathname;
      if (path === currentPath) {
        return originalPushState(state, title, url);
      }

      // Block and surface to the modal
      setPendingPath(path);
      return undefined as unknown as void;
    };

    // Back/forward buttons trigger popstate; wouter listens to these too.
    const onPopState = () => {
      if (!isDirtyRef.current || ignoringRef.current) return;
      // Re-push the current state so the browser URL doesn't change
      originalPushState(history.state, '', window.location.pathname);
      setPendingPath('__back__'); // special sentinel — confirmNavigation will call history.back()
    };

    window.addEventListener('popstate', onPopState);

    return () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', onPopState);
    };
  }, []); // intentionally no deps — we use isDirtyRef for the live value

  const confirmNavigation = useCallback(() => {
    if (!pendingPath) return;
    const destination = pendingPath;
    ignoringRef.current = true;
    setPendingPath(null);
    // Allow one tick for React state to settle, then navigate
    setTimeout(() => {
      if (destination === '__back__') {
        history.back();
      } else {
        navigate(destination);
      }
      ignoringRef.current = false;
    }, 0);
  }, [pendingPath, navigate]);

  const cancelNavigation = useCallback(() => {
    setPendingPath(null);
  }, []);

  return { pendingPath, confirmNavigation, cancelNavigation };
}
