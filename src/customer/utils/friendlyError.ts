/**
 * Turns any thrown value into a message that is safe to show a shopper.
 *
 * If the Error message looks like a user-facing Spanish sentence (starts with
 * a letter/accent and contains no SQL/technical markers), it is shown directly.
 * Otherwise the caller-supplied fallback is used.
 */
export function friendlyError(error: unknown, fallback: string): string {
  if (error) {
    console.error('[handled error]', error);
  }

  if (error instanceof Error && error.message) {
    const msg = error.message;
    const isTechnical =
      /violat|constraint|policy|column|supabase|pgcode|relation|undefined|null|cannot|typeerror/i.test(msg);
    const isSpanish = /^[A-ZÁÉÍÓÚÑa-záéíóúñ¿¡]/.test(msg);
    if (isSpanish && !isTechnical) {
      return msg;
    }
  }

  return fallback;
}
