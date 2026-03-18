/**
 * Resolves the backend API base URL.
 *
 * In local development the env var is typically "http://localhost:4000".
 * When the site is opened from another device on the same LAN (e.g. an
 * iPhone accessing http://192.168.1.42:3000), "localhost" would point at the
 * phone itself rather than the dev machine.  This helper detects that
 * situation and swaps in the current page hostname so API calls still reach
 * the backend running on the dev machine.
 */
function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

  try {
    const url = new URL(configured);

    // Only rewrite when the configured host is localhost/127.0.0.1 but the
    // browser is NOT on localhost (i.e. we're accessing via LAN IP).
    const isConfiguredLocal =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const isBrowserLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');

    if (isConfiguredLocal && !isBrowserLocal && typeof window !== 'undefined') {
      url.hostname = window.location.hostname;
      const resolved = url.origin; // drops trailing slash
      console.log(
        `[apiBase] Rewrote API_BASE from ${configured} → ${resolved} (LAN access detected)`
      );
      return resolved;
    }
  } catch {
    // If URL parsing fails for some reason, fall through to the raw value.
  }

  return configured;
}

export const API_BASE = resolveApiBase();
