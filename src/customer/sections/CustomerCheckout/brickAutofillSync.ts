// iOS Safari autofill can set input values without firing the events the
// Mercado Pago Brick listens to, so filled fields are reported as empty.
// Re-emitting an `input` event lets the Brick pick up the real value.
function resyncInput(el: HTMLInputElement) {
  if (el.type === 'hidden' || !el.value) return;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function attachBrickAutofillSync(container: HTMLElement): () => void {
  const onFieldEvent = (e: Event) => {
    if (e.target instanceof HTMLInputElement) resyncInput(e.target);
  };
  const resyncAll = () => {
    container.querySelectorAll('input').forEach(resyncInput);
  };

  container.addEventListener('change', onFieldEvent, true);
  container.addEventListener('focusout', onFieldEvent, true);
  container.addEventListener('pointerdown', resyncAll, true);

  return () => {
    container.removeEventListener('change', onFieldEvent, true);
    container.removeEventListener('focusout', onFieldEvent, true);
    container.removeEventListener('pointerdown', resyncAll, true);
  };
}
