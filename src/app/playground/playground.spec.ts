import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { queryRequired } from '../../testing/dom';
import { Playground } from './playground';

describe('Playground', () => {
  let fixture: ComponentFixture<Playground>;
  let playground: Playground;
  let element: HTMLElement;

  beforeEach(async () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(Playground);
    playground = fixture.componentInstance;
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('generates a minimal template, omitting defaults', () => {
    expect(playground.code()).toBe(
      [
        '<ui-carousel',
        '  [items]="planets"',
        '  label="Planets"',
        '  [interval]="4000"',
        '>',
        '  <ng-template [uiCarouselSlide]="planets" let-planet>',
        '    <app-planet-card [planet]="planet" />',
        '  </ng-template>',
        '</ui-carousel>',
      ].join('\n'),
    );
  });

  it('reflects changed options in the template', () => {
    playground.loop.set(false);
    playground.orientation.set('vertical');
    playground.flickVelocity.set(0.8);

    expect(playground.code()).toContain('[loop]="false"');
    expect(playground.code()).toContain('orientation="vertical"');
    expect(playground.code()).toContain('[swipeOptions]="{ flickVelocity: 0.8 }"');
  });

  it('renders one slide per planet and updates the live carousel', () => {
    expect(element.querySelectorAll('.ui-carousel__dot')).toHaveLength(5);

    playground.slideCount.set(3);
    fixture.detectChanges();
    expect(element.querySelectorAll('.ui-carousel__dot')).toHaveLength(3);
  });

  it('drives the carousel from custom controls through exportAs', () => {
    const next = [...element.querySelectorAll<HTMLButtonElement>('.custom-controls button')].at(-1);
    next?.click();
    fixture.detectChanges();

    expect(queryRequired(element, '[data-testid="state-index"]').textContent.trim()).toBe('1 / 5');
    expect(element.querySelector('.log')?.textContent).toContain('Venus');
  });

  it('can hide the built-in controls', () => {
    playground.controls.set(false);
    fixture.detectChanges();
    expect(element.querySelector('.ui-carousel__controls')).toBeNull();
  });
});
