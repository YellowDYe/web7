/**
 * Turns any thrown value into a message that is safe to show a shopper.
 *
 * Internal errors (database constraint text, policy violations, provider
 * responses, stack traces) must never reach the interface: they describe the
 * schema and the access rules to whoever triggered them. So the raw value is
 * logged for developers and only the caller-supplied Spanish fallback is
 * returned to the screen.
 */
export function friendlyError(error: unknown, fallback: string): string {
  if (error) {
    // Developer-facing only. Never rendered.
    console.error('[handled error]', error);
  }
  return fallback;
}
