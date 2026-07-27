/**
 * HTML sanitization utilities to prevent injection in email templates and user-facing content.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
};

const HTML_ESCAPE_RE = /[&<>"'`/]/g;

/**
 * Escapes a string for safe interpolation into HTML.
 * Use this for ANY user-controlled value placed inside HTML templates.
 */
export function escapeHtml(input: string | null | undefined): string {
  if (input == null) return '';
  return String(input).replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE_MAP[ch] || ch);
}

/**
 * Delimiter-wrapped user content for LLM prompts.
 * Prevents prompt injection by clearly marking user-controlled input.
 */
export function wrapUserContent(userMessage: string): string {
  return `<<<BEGIN_USER_INPUT>>>\n${userMessage}\n<<<END_USER_INPUT>>>`;
}
