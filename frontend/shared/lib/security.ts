/**
 * Escapes HTML special characters to prevent XSS when interpolating
 * user-controlled data into raw HTML strings (e.g. document.write / print windows).
 *
 * React JSX automatically escapes content, so this is only needed for
 * manual HTML template literals written to document.write() or similar APIs.
 *
 * Note: When value is an object, JSON.stringify() is used instead of String()
 * to avoid the "[object Object]" default stringification format and provide
 * meaningful JSON representation.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  let str = '';
  if (typeof value === 'string') {
    str = value;
  } else if (typeof value === 'object') {
    str = JSON.stringify(value);
  } else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    str = String(value);
  } else if (typeof value === 'symbol' || typeof value === 'function') {
    str = value.toString();
  }
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Sanitizes user input to prevent SQL injection in LIKE queries.
 * Escapes special characters: %, _, \
 */
export function sanitizeLikeQuery(input: string): string {
  if (!input) return '';
  return input
    .replaceAll('\\', String.raw`\\`)
    .replaceAll('%', String.raw`\%`)
    .replaceAll('_', String.raw`\_`);
}

/**
 * Validates UUID format (v4)
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
