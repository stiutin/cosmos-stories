import { Component, DestroyRef, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/**
 * The daily build brings new pictures. When the service worker has downloaded
 * a new version, offer to switch to it instead of silently keeping the old one.
 */
@Component({
  selector: 'app-update-prompt',
  template: `
    @if (ready()) {
      <div class="prompt" role="status">
        <span>New space pictures are ready.</span>
        <button type="button" (click)="reload()">Refresh</button>
        <button
          type="button"
          class="prompt__dismiss"
          aria-label="Dismiss"
          (click)="ready.set(false)"
        >
          ✕
        </button>
      </div>
    }
  `,
  styles: `
    .prompt {
      align-items: center;
      background: rgba(12, 9, 36, 0.95);
      border: 1px solid var(--color-white-35);
      border-radius: 50px;
      bottom: max(16px, env(safe-area-inset-bottom));
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      display: flex;
      font-size: 0.85rem;
      gap: 12px;
      left: 50%;
      padding: 8px 8px 8px 18px;
      position: fixed;
      transform: translateX(-50%);
      z-index: 200;
    }
    button {
      background: var(--color-white);
      border: none;
      border-radius: 50px;
      color: var(--color-bg);
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      padding: 6px 14px;
    }
    .prompt__dismiss {
      background: transparent;
      color: var(--color-white);
      padding: 6px 10px;
    }
    button:focus-visible {
      outline: 2px solid var(--color-white);
      outline-offset: 2px;
    }
  `,
})
export class UpdatePrompt {
  private readonly updates = inject(SwUpdate);
  protected readonly ready = signal(false);

  constructor() {
    if (!this.updates.isEnabled) return;
    const subscription = this.updates.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') this.ready.set(true);
    });
    inject(DestroyRef).onDestroy(() => {
      subscription.unsubscribe();
    });
  }

  protected reload(): void {
    document.location.reload();
  }
}
