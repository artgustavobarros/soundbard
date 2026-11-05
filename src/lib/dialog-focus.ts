export function restoreWorkspaceFocus(event: Event) {
  if (document.querySelector('[role="dialog"][data-state="open"]')) {
    return;
  }
  const trigger = document.querySelector<HTMLButtonElement>(
    '[data-slot="sheet-trigger"][aria-label="Abrir menu"]'
  );
  if (trigger) {
    event.preventDefault();
    trigger.focus();
  }
}
