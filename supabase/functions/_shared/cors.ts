/**
 * Shared CORS configuration for Supabase Edge Functions.
 * 
 * IMPORTANT: In production, set CORS_ALLOWED_ORIGINS environment variable
 * to your specific domains (e.g., "https://muhimat.vercel.app,https://admin.muhimat.com")
 * 
 * Default allows common local development ports.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5000",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5000",
];

function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get("CORS_ALLOWED_ORIGINS");
  if (envOrigins) {
    return envOrigins.split(",").map(o => o.trim()).filter(Boolean);
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

function isOriginAllowed(origin: string): boolean {
  const allowed = getAllowedOrigins();
  // Always require exact match — never allow wildcard localhost patterns.
  // Add your dev origins to CORS_ALLOWED_ORIGINS env var when needed.
  return allowed.includes(origin);
}

export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();

  // Only reflect the origin if it is in the explicit allow-list.
  // If the requestOrigin is null or not allowed, default to the first
  // allowed origin. Never echo back an unlisted origin.
  const origin = (requestOrigin && isOriginAllowed(requestOrigin))
    ? requestOrigin
    : null;

  return {
    'Access-Control-Allow-Origin': origin as string,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    // Credentials are NOT set because authentication uses the
    // Authorization header (JWT), not cookies.
    // 'Access-Control-Allow-Credentials': 'true',  ← disabled for security
  };
}

export function handleCorsPreflight(requestOrigin: string | null): Response {
  if (!requestOrigin || !isOriginAllowed(requestOrigin)) {
    return new Response(null, { status: 403 });
  }
  const headers = getCorsHeaders(requestOrigin);
  return new Response(null, { 
    headers,
    status: 204 
  });
}

// Re-export for backward compatibility during migration
export const corsHeaders = getCorsHeaders(null);
