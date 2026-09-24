import { TestBed } from '@angular/core/testing';
import type { VersionEvent } from '@angular/service-worker';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { UpdatePrompt } from './update-prompt';

describe('UpdatePrompt', () => {
  function render(isEnabled: boolean) {
    const versionUpdates = new Subject<VersionEvent>();
    TestBed.configureTestingModule({
      providers: [{ provide: SwUpdate, useValue: { isEnabled, versionUpdates } }],
    });
    const fixture = TestBed.createComponent(UpdatePrompt);
    fixture.detectChanges();
    return { fixture, versionUpdates, element: fixture.nativeElement as HTMLElement };
  }

  const ready = {
    type: 'VERSION_READY',
    currentVersion: { hash: 'a' },
    latestVersion: { hash: 'b' },
  } as const;

  it('stays hidden until a new version is ready', () => {
    const { fixture, versionUpdates, element } = render(true);
    expect(element.querySelector('[role="status"]')).toBeNull();

    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'b' } });
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')).toBeNull();

    versionUpdates.next(ready);
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('New space pictures');
  });

  it('can be dismissed', () => {
    const { fixture, versionUpdates, element } = render(true);
    versionUpdates.next(ready);
    fixture.detectChanges();

    element.querySelector<HTMLButtonElement>('[aria-label="Dismiss"]')?.click();
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')).toBeNull();
  });

  it('does nothing without a service worker', () => {
    const { fixture, versionUpdates, element } = render(false);
    versionUpdates.next(ready);
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')).toBeNull();
  });
});
