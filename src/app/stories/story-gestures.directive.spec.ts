import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { queryRequired } from '../../testing/dom';
import { HOLD_DELAY_MS, StoryGesturesDirective } from './story-gestures.directive';

@Component({
  imports: [StoryGesturesDirective],
  template: `
    <div
      class="stage"
      appStoryGestures
      (tapPrev)="log.push('prev')"
      (tapNext)="log.push('next')"
      (holdChange)="log.push('hold:' + $event)"
      (dragStart)="log.push('dragStart')"
      (dragMove)="log.push('drag:' + $event)"
      (dragEnd)="log.push('dragEnd:' + $event)"
      (dismissMove)="log.push('dismiss:' + $event)"
      (dismiss)="log.push('dismissed')"
    >
      <button class="inner">Button</button>
    </div>
  `,
})
class Host {
  readonly log: string[] = [];
}

describe('StoryGesturesDirective', () => {
  let fixture: ComponentFixture<Host>;
  let stage: HTMLElement;
  let log: string[];
  let time = 0;

  function pointer(type: string, x: number, y: number, target: Element = stage): void {
    time += 16;
    const event = new PointerEvent(type, {
      bubbles: true,
      isPrimary: true,
      pointerId: 1,
      pointerType: 'touch',
      clientX: x,
      clientY: y,
    });
    Object.defineProperty(event, 'timeStamp', { value: time });
    target.dispatchEvent(event);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    stage = queryRequired(fixture.nativeElement as HTMLElement, '.stage');
    log = fixture.componentInstance.log;
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 600 }) as DOMRect;
    Object.defineProperty(stage, 'clientWidth', { value: 300 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats a tap on the left third as "previous" and elsewhere as "next"', () => {
    pointer('pointerdown', 50, 300);
    pointer('pointerup', 50, 300);
    pointer('pointerdown', 250, 300);
    pointer('pointerup', 251, 300);

    expect(log).toEqual(['prev', 'next']);
  });

  it('pauses while held, without tapping', () => {
    pointer('pointerdown', 200, 300);
    vi.advanceTimersByTime(HOLD_DELAY_MS + 10);
    pointer('pointerup', 200, 300);

    expect(log).toEqual(['hold:true', 'hold:false']);
  });

  it('reports horizontal drags and swipe direction', () => {
    pointer('pointerdown', 250, 300);
    pointer('pointermove', 200, 302);
    pointer('pointermove', 100, 304);
    pointer('pointerup', 100, 304);

    expect(log[0]).toBe('dragStart');
    expect(log).toContain('drag:-150');
    expect(log.at(-1)).toBe('dragEnd:1');
  });

  it('closes on a long drag down, and springs back on a short one', () => {
    pointer('pointerdown', 150, 100);
    pointer('pointermove', 152, 200);
    pointer('pointermove', 152, 260);
    vi.advanceTimersByTime(1000);
    time += 1000;
    pointer('pointerup', 152, 260);
    expect(log).toEqual(['dismiss:100', 'dismiss:160', 'dismissed']);

    log.length = 0;
    pointer('pointerdown', 150, 100);
    pointer('pointermove', 150, 140);
    time += 1000;
    pointer('pointerup', 150, 140);
    expect(log).toEqual(['dismiss:40', 'dismiss:0']);
  });

  it('snaps everything back when the system cancels the gesture', () => {
    pointer('pointerdown', 250, 300);
    pointer('pointermove', 150, 300);
    pointer('pointercancel', 150, 300);

    expect(log.at(-1)).toBe('dragEnd:0');
  });

  it('leaves gestures that start on buttons alone', () => {
    const button = queryRequired(stage, '.inner');
    pointer('pointerdown', 250, 300, button);
    pointer('pointerup', 250, 300, button);

    expect(log).toEqual([]);
  });
});
