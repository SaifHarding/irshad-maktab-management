import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isPortalDomain } from "@/lib/portalPaths";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp(
      `(?:^|; )${name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}=([^;]*)`
    )
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  const isMasjidDomain =
    window.location.hostname === "masjidirshad.co.uk" ||
    window.location.hostname.endsWith(".masjidirshad.co.uk");

  const cookieDomain = isMasjidDomain ? "; domain=.masjidirshad.co.uk" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax; secure${cookieDomain}`;
}

function deleteCookie(name: string) {
  const isMasjidDomain =
    window.location.hostname === "masjidirshad.co.uk" ||
    window.location.hostname.endsWith(".masjidirshad.co.uk");

  const cookieDomain = isMasjidDomain ? "; domain=.masjidirshad.co.uk" : "";
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax; secure${cookieDomain}`;
}

/**
 * Shared storage:
 * - READ from cookie first, then fall back to localStorage (because the main app client
 *   may have already consumed the auth hash and stored the session there).
 * - WRITE to both cookie + localStorage so subsequent loads work everywhere.
 */
const sharedStorage = {
  getItem: (key: string) => {
    return getCookie(key) ?? localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    setCookie(key, value);
    localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    deleteCookie(key);
    localStorage.removeItem(key);
  },
};

/**
 * Lazy singleton pattern - only create portal client when needed
 * This prevents "Multiple GoTrueClient instances" warning on non-portal domains
 */
let _portalSupabaseInstance: SupabaseClient<Database> | null = null;

function getPortalSupabase(): SupabaseClient<Database> {
  if (!_portalSupabaseInstance) {
    _portalSupabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: sharedStorage as any,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _portalSupabaseInstance;
}

/**
 * Portal client persists auth across subdomains (attendance ↔ portal) via cookie.
 * Uses lazy initialization to avoid creating duplicate GoTrueClient instances.
 * 
 * On portal domain: creates a client with cookie-based storage
 * On other domains: returns the getter function for lazy access
 */
export const portalSupabase: SupabaseClient<Database> = isPortalDomain
  ? getPortalSupabase()
  : (new Proxy({} as SupabaseClient<Database>, {
      get(_target, prop) {
        // Lazily get the portal client only when accessed
        return getPortalSupabase()[prop as keyof SupabaseClient<Database>];
      },
    }) as SupabaseClient<Database>);
