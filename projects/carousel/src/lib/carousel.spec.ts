import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { SwipeAxis } from '@cosmos-stories/carousel/core';
import { UiCarousel } from './carousel';
import { UiCarouselSlide } from './carousel-slide.directive';

const INTERVAL = 1000;
const TRANSITION = 380;
const SETTLE = TRANSITION + 100;

@Component({
  imports: [UiCarousel, UiCarouselSlide],
  template: `
    <ui-carousel
      label="Test carousel"
      [items]="items()"
      [loop]="loop()"
      [autoplay]="autoplay()"
      [controls]="controls()"
      [orientation]="orientation()"
      [interval]="interval"
      [itemLabel]="itemLabel"
      (indexChange)="changes.push($event)"
    >
      <ng-template [uiCarouselSlide]="items()" let-item let-index="index" let-active="active">
        <p class="content" [class.content--active]="active">{{ item }}:{{ index }}</p>
        <a class="content-link" href="#{{ item }}">{{ item }}</a>
      </ng-template>
    </ui-carousel>
  `,
})
class Host {
  readonly items = signal(['a', 'b', 'c']);
  readonly loop = signal(true);
  readonly autoplay = signal(true);
  readonly controls = signal(true);
  readonly orientation = signal<SwipeAxis>('horizontal');
  readonly interval = INTERVAL;
  readonly changes: number[] = [];
  readonly itemLabel = (item: string): string => `Item ${item}`;
}

describe('UiCarousel', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let carousel: UiCarousel<string>;
  let element: HTMLElement;

  const query = (selector: string): HTMLElement => {
    const found = element.querySelector<HTMLElement>(selector);
    if (!found) throw new Error(`${selector} not found`);
    return found;
  };
  const slides = (): HTMLElement[] => [
    ...element.querySelectorAll<HTMLElement>('.ui-carousel__slide'),
  ];
  const dots = (): HTMLElement[] => [...element.querySelectorAll<HTMLElement>('.ui-carousel__dot')];
  const activeLabel = (): string | null =>
    query('.ui-carousel__slide--active').getAttribute('aria-label');
  const track = (): HTMLElement => query('.ui-carousel__track');
  const region = (): HTMLElement => query('.ui-carousel');

  async function wait(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }

  function press(key: string): void {
    region().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  }

  function pointer(type: string, init: PointerEventInit = {}): void {
    region().dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        isPrimary: true,
        pointerId: 1,
        pointerType: 'touch',
        ...init,
      }),
    );
    fixture.detectChanges();
  }

  function swipe(from: [number, number], to: [number, number]): void {
    pointer('pointerdown', { clientX: from[0], clientY: from[1] });
    pointer('pointermove', {
      clientX: (from[0] + to[0]) / 2,
      clientY: (from[1] + to[1]) / 2,
    });
    pointer('pointermove', { clientX: to[0], clientY: to[1] });
    pointer('pointerup', { clientX: to[0], clientY: to[1] });
  }

  async function setUp(configure: (host: Host) => void = () => undefined): Promise<void> {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    configure(host);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    carousel = fixture.debugElement.query(By.directive(UiCarousel))
      .componentInstance as UiCarousel<string>;
    Object.defineProperty(region(), 'clientWidth', { value: 400 });
    Object.defineProperty(region(), 'clientHeight', { value: 800 });
    await wait(0);
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  describe('rendering and accessibility', () => {
    beforeEach(async () => {
      await setUp();
    });

    it('renders each item through the projected template, wrapped in loop clones', () => {
      expect(slides()).toHaveLength(5);
      expect([...element.querySelectorAll('.content')].map((node) => node.textContent)).toEqual([
        'c:2',
        'a:0',
        'b:1',
        'c:2',
        'a:0',
      ]);
      expect(slides().map((slide) => slide.getAttribute('aria-hidden'))).toEqual([
        'true',
        null,
        null,
        null,
        'true',
      ]);
    });

    it('exposes the WAI-ARIA carousel structure', () => {
      expect(region().getAttribute('aria-roledescription')).toBe('carousel');
      expect(region().getAttribute('aria-label')).toBe('Test carousel');
      expect(activeLabel()).toBe('1 of 3');
      expect(dots().map((dot) => dot.getAttribute('aria-label'))).toEqual([
        'Item a',
        'Item b',
        'Item c',
      ]);
    });

    it('makes every slide except the active one inert', () => {
      expect(query('.ui-carousel__slide--active').hasAttribute('inert')).toBe(false);
      expect(slides().filter((slide) => slide.hasAttribute('inert'))).toHaveLength(4);
      expect(query('.content--active').textContent).toBe('a:0');
    });

    it('announces changes only while autoplay is stopped', () => {
      const viewport = query('.ui-carousel__viewport');
      expect(viewport.getAttribute('aria-live')).toBe('off');

      carousel.toggleAutoplay();
      fixture.detectChanges();
      expect(viewport.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('navigation', () => {
    beforeEach(async () => {
      await setUp();
    });

    it('goes to a slide from its indicator and emits indexChange', () => {
      dots()[2]?.click();
      fixture.detectChanges();

      expect(carousel.index()).toBe(2);
      expect(dots()[2]?.getAttribute('aria-current')).toBe('true');
      expect(host.changes).toEqual([2]);
    });

    it('keeps moving forward from the last slide to the first', async () => {
      carousel.goTo(2);
      await wait(SETTLE);

      carousel.next();
      fixture.detectChanges();
      expect(track().style.transform).toContain('-400%');
      expect(carousel.index()).toBe(0);

      await wait(SETTLE);
      expect(track().style.transform).toContain('-100%');
      expect(track().style.transition).toBe('none');
      expect(activeLabel()).toBe('1 of 3');
    });

    it('settles as soon as the track transition ends', () => {
      carousel.prev();
      fixture.detectChanges();
      expect(track().style.transform).toContain('calc(0% ');

      const event = new Event('transitionend', { bubbles: true });
      Object.defineProperty(event, 'propertyName', { value: 'transform' });
      track().dispatchEvent(event);
      fixture.detectChanges();

      expect(track().style.transform).toContain('-300%');
    });

    it('queues a move requested before the jump off a clone is painted', async () => {
      carousel.goTo(2);
      await wait(SETTLE);
      carousel.next(); // animating onto the trailing clone
      fixture.detectChanges();
      carousel.next(); // arrives before settling
      fixture.detectChanges();
      expect(track().style.transform).toContain('-100%'); // jumped off the clone first

      await wait(50); // two animation frames later the queued move runs
      expect(carousel.index()).toBe(1);
      expect(track().style.transform).toContain('-200%');
    });

    it('supports arrow, Home and End keys', () => {
      press('ArrowRight');
      expect(carousel.index()).toBe(1);
      press('ArrowLeft');
      expect(carousel.index()).toBe(0);
      press('End');
      expect(carousel.index()).toBe(2);
      press('Home');
      expect(carousel.index()).toBe(0);
    });

    it('moves focus to the new slide when the focused slide becomes inert', async () => {
      query('.ui-carousel__slide--active .content-link').focus();
      press('ArrowRight');
      await wait(50);

      expect(document.activeElement).toBe(query('.ui-carousel__slide--active'));
    });
  });

  describe('autoplay', () => {
    beforeEach(async () => {
      await setUp();
    });

    it('advances every interval and wraps around', async () => {
      await wait(INTERVAL + 50);
      expect(carousel.index()).toBe(1);

      await wait(INTERVAL * 2);
      expect(carousel.index()).toBe(0);
    });

    it('shows progress in the active indicator', async () => {
      await wait(INTERVAL / 2);
      const fill = query('.ui-carousel__dot--active .ui-carousel__dot-fill');
      expect(fill.style.transform).toMatch(/scaleX\(0\.[45]/);
    });

    it('can be paused and resumed with the rotation control', async () => {
      const button = query('.ui-carousel__autoplay');
      button.click();
      fixture.detectChanges();
      expect(button.getAttribute('aria-label')).toBe('Play slideshow');

      await wait(INTERVAL * 3);
      expect(carousel.index()).toBe(0);

      button.click();
      await wait(INTERVAL + 50);
      expect(carousel.index()).toBe(1);
    });

    it('pauses while a mouse hovers over the carousel', async () => {
      pointer('pointerenter', { pointerType: 'mouse', bubbles: false });
      await wait(INTERVAL * 2);
      expect(carousel.index()).toBe(0);

      pointer('pointerleave', { pointerType: 'mouse', bubbles: false });
      await wait(INTERVAL + 50);
      expect(carousel.index()).toBe(1);
    });

    it('ignores hover from touch pointers', () => {
      pointer('pointerenter', { pointerType: 'touch', bubbles: false });
      expect(carousel.isPausedBy('hover')).toBe(false);
    });

    it('pauses while focus is inside and resumes when it leaves', () => {
      const link = query('.ui-carousel__slide--active .content-link');
      link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(carousel.isPausedBy('focus')).toBe(true);

      link.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: dots()[0] }));
      expect(carousel.isPausedBy('focus')).toBe(true);

      link.dispatchEvent(
        new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }),
      );
      expect(carousel.isPausedBy('focus')).toBe(false);
    });

    it('pauses in hidden tabs', () => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(carousel.isPausedBy('hidden')).toBe(true);

      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(carousel.isPausedBy('hidden')).toBe(false);
    });

    it('follows the autoplay input', () => {
      host.autoplay.set(false);
      fixture.detectChanges();
      expect(carousel.playing()).toBe(false);
    });
  });

  describe('gestures', () => {
    beforeEach(async () => {
      await setUp();
    });

    it('goes to the next slide on a swipe left and back on a swipe right', () => {
      swipe([300, 100], [150, 104]);
      expect(carousel.index()).toBe(1);

      swipe([100, 100], [300, 98]);
      expect(carousel.index()).toBe(0);
    });

    it('follows the pointer while dragging', () => {
      pointer('pointerdown', { clientX: 300, clientY: 100 });
      pointer('pointermove', { clientX: 260, clientY: 100 });

      expect(track().style.transform).toContain('+ -40px');
      expect(track().style.transition).toBe('none');
      expect(carousel.isPausedBy('drag')).toBe(true);
    });

    it('snaps back when the system cancels the gesture', () => {
      pointer('pointerdown', { clientX: 300, clientY: 100 });
      pointer('pointermove', { clientX: 200, clientY: 100 });
      pointer('pointercancel');

      expect(carousel.index()).toBe(0);
      expect(carousel.isPausedBy('drag')).toBe(false);
      expect(track().style.transform).toContain('+ 0px');
    });

    it('ignores vertical movement in horizontal mode', () => {
      swipe([200, 100], [205, 400]);
      expect(carousel.index()).toBe(0);
    });

    it('swallows the click that follows a mouse drag', () => {
      const clicked = vi.fn();
      const link = query('.ui-carousel__slide--active .content-link');
      link.addEventListener('click', clicked);

      pointer('pointerdown', { clientX: 300, clientY: 100, pointerType: 'mouse', button: 0 });
      pointer('pointermove', { clientX: 250, clientY: 100, pointerType: 'mouse' });
      pointer('pointerup', { clientX: 250, clientY: 100, pointerType: 'mouse' });
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      expect(clicked).not.toHaveBeenCalled();
    });

    it('lets a plain tap click through', () => {
      const clicked = vi.fn((event: Event) => {
        event.preventDefault();
      });
      const link = query('.ui-carousel__slide--active .content-link');
      link.addEventListener('click', clicked);

      pointer('pointerdown', { clientX: 300, clientY: 100, pointerType: 'mouse', button: 0 });
      pointer('pointerup', { clientX: 301, clientY: 100, pointerType: 'mouse' });
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      expect(clicked).toHaveBeenCalledOnce();
    });

    it('ignores secondary mouse buttons and non-primary pointers', () => {
      pointer('pointerdown', { clientX: 300, clientY: 100, pointerType: 'mouse', button: 2 });
      pointer('pointermove', { clientX: 100, clientY: 100, pointerType: 'mouse' });
      pointer('pointerup', { clientX: 100, clientY: 100, pointerType: 'mouse' });
      pointer('pointerdown', { clientX: 300, clientY: 100, isPrimary: false, pointerId: 2 });
      pointer('pointermove', { clientX: 100, clientY: 100, pointerId: 2 });
      pointer('pointerup', { clientX: 100, clientY: 100, pointerId: 2 });

      expect(carousel.index()).toBe(0);
    });
  });

  describe('configuration', () => {
    it('stops at the ends and renders no clones without looping', async () => {
      await setUp((h) => {
        h.loop.set(false);
        h.autoplay.set(false);
      });

      expect(slides()).toHaveLength(3);
      press('ArrowLeft');
      expect(carousel.index()).toBe(0);

      press('End');
      press('ArrowRight');
      expect(carousel.index()).toBe(2);
    });

    it('rewinds to the first slide when autoplay reaches the end without looping', async () => {
      await setUp((h) => {
        h.loop.set(false);
      });
      carousel.goTo(2);
      await wait(INTERVAL + 50);

      expect(carousel.index()).toBe(0);
    });

    it('can hide the built-in controls', async () => {
      await setUp((h) => {
        h.controls.set(false);
      });
      expect(element.querySelector('.ui-carousel__controls')).toBeNull();
    });

    it('supports vertical orientation', async () => {
      await setUp((h) => {
        h.orientation.set('vertical');
        h.autoplay.set(false);
      });

      expect(track().style.transform).toMatch(/^translate3d\(0(px)?, calc\(-100%/);
      press('ArrowDown');
      expect(carousel.index()).toBe(1);
      press('ArrowUp');
      expect(carousel.index()).toBe(0);

      swipe([200, 600], [204, 300]);
      expect(carousel.index()).toBe(1);
    });

    it('adapts when the items change', async () => {
      await setUp();
      carousel.goTo(2);
      fixture.detectChanges();

      host.items.set(['x', 'y']);
      fixture.detectChanges();
      await wait(0);

      expect(carousel.count()).toBe(2);
      expect(carousel.index()).toBe(1);
      expect(slides()).toHaveLength(4);
    });

    it('hides the controls when there is nothing to rotate', async () => {
      await setUp((h) => {
        h.items.set(['only']);
      });
      expect(element.querySelector('.ui-carousel__controls')).toBeNull();
      expect(slides()).toHaveLength(1);
    });
  });
});
