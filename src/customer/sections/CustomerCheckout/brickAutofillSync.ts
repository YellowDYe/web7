// iOS Safari autofill can set input values without firing the events the
// Mercado Pago Brick listens to, so filled fields are reported as empty.
// Re-emitting an `input` event lets the Brick pick up the real value.
function resyncInput(el: HTMLInputElement) {
  if (el.type === 'hidden' || !el.value) return;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

function isEmailInput(el: HTMLInputElement) {
  const hints = `${el.type} ${el.name} ${el.id} ${el.autocomplete}`.toLowerCase();
  return hints.includes('email');
}

// The Brick should hide its email field when a payer email is provided, but on
// some devices it still shows it empty. Fill it the same way typing would.
export function fillBrickEmail(container: HTMLElement, email: string | undefined) {
  if (!email || !nativeValueSetter) return;
  container.querySelectorAll('input').forEach((el) => {
    if (!isEmailInput(el) || el.value.trim()) return;
    nativeValueSetter.call(el, email);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const VALIDATION_ERROR_PATTERN = /dato obligatorio|completa todos los datos|elige una opci/i;
const VALIDATION_CHECK_DELAY_MS = 900;

interface BrickSyncOptions {
  payerEmail?: string;
  lastSubmitAt: () => number;
  onBlockedSubmit: () => void;
}

export function attachBrickAutofillSync(container: HTMLElement, options: BrickSyncOptions): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];

  const onFieldEvent = (e: Event) => {
    if (e.target instanceof HTMLInputElement) resyncInput(e.target);
  };
  const resyncAll = () => {
    fillBrickEmail(container, options.payerEmail);
    container.querySelectorAll('input').forEach(resyncInput);
  };
  const onClick = (e: Event) => {
    const button = (e.target as HTMLElement | null)?.closest('button');
    if (!button || !(button.type === 'submit' || /pagar/i.test(button.textContent || ''))) return;
    const clickedAt = Date.now();
    timers.push(setTimeout(() => {
      if (options.lastSubmitAt() >= clickedAt) return;
      if (VALIDATION_ERROR_PATTERN.test(container.textContent || '')) options.onBlockedSubmit();
    }, VALIDATION_CHECK_DELAY_MS));
  };

  container.addEventListener('change', onFieldEvent, true);
  container.addEventListener('focusout', onFieldEvent, true);
  container.addEventListener('pointerdown', resyncAll, true);
  container.addEventListener('click', onClick, true);

  return () => {
    timers.forEach(clearTimeout);
    container.removeEventListener('change', onFieldEvent, true);
    container.removeEventListener('focusout', onFieldEvent, true);
    container.removeEventListener('pointerdown', resyncAll, true);
    container.removeEventListener('click', onClick, true);
  };
}
