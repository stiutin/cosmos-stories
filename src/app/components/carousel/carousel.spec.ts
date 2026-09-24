import { signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { Slide } from '../../models/slide.model';
import { BannerService } from '../../services/banner.service';
import { CarouselComponent } from './carousel';

function slide(id: string, title: string): Slide {
  return {
    id,
    bgImage: 'slides/nebula-bg.svg',
    bgSources: [],
    visualImage: null,
    theme: 'photo',
    contentAlign: 'left',
    kicker: null,
    title,
    textParts: [{ text: 'Text' }],
    buttonText: 'Go',
    buttonLink: null,
    credit: null,
  };
}

/**
 * Carousel behaviour is tested in the library (`projects/carousel`).
 * Here we only check what this consumer adds: error state and data wiring.
 */
describe('CarouselComponent (banner consumer)', () => {
  let fixture: ComponentFixture<CarouselComponent>;
  let element: HTMLElement;
  const slides = signal<readonly Slide[]>([]);
  const error = signal<Error | undefined>(undefined);
  const reload = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    slides.set([]);
    error.set(undefined);
    reload.mockReset();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BannerService,
          useValue: { slides, error, isLoading: signal(false), isSample: signal(false), reload },
        },
      ],
    });
    fixture = TestBed.createComponent(CarouselComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('renders the slides in the library carousel, labelled by title', () => {
    slides.set([slide('a', 'Alpha'), slide('b', 'Beta')]);
    fixture.detectChanges();

    expect(element.querySelectorAll('app-slide')).toHaveLength(4); // 2 + 2 loop clones
    expect(
      [...element.querySelectorAll('.ui-carousel__dot')].map((dot) =>
        dot.getAttribute('aria-label'),
      ),
    ).toEqual(['Slide 1: Alpha', 'Slide 2: Beta']);
  });

  it('prioritises only the first real slide', () => {
    slides.set([slide('a', 'Alpha'), slide('b', 'Beta')]);
    fixture.detectChanges();

    const priorities = [...element.querySelectorAll('.slide__bg')].map((image) =>
      image.getAttribute('fetchpriority'),
    );
    expect(priorities).toEqual(['low', 'high', 'low', 'low']);
  });

  it('keeps the carousel and offers a retry when loading fails', () => {
    slides.set([slide('a', 'Alpha')]);
    error.set(new Error('offline'));
    fixture.detectChanges();

    expect(element.querySelector('ui-carousel')).not.toBeNull();
    const alert = element.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Couldn't load");
    element.querySelector<HTMLButtonElement>('.carousel__retry')?.click();
    expect(reload).toHaveBeenCalledOnce();
  });
});
