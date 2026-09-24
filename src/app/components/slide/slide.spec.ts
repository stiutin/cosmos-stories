import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';

import type {Slide} from '../../models/slide.model';
import {SlideComponent} from './slide';

const baseSlide: Slide = {
  id: 'test',
  bgImage: 'bg.svg',
  bgSources: [],
  visualImage: 'visual.svg',
  theme: 'nebula',
  contentAlign: 'center',
  title: 'Test title',
  textParts: [{text: 'Up to '}, {text: '35% off', accent: true}, {text: ': daily, weekly!'}],
  buttonText: 'Go',
  buttonLink: null,
  kicker: null,
  credit: null,
};

function render(slide: Slide, priority = false): HTMLElement {
  const fixture = TestBed.createComponent(SlideComponent);
  fixture.componentRef.setInput('slide', slide);
  fixture.componentRef.setInput('priority', priority);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function slideElement(host: HTMLElement): HTMLElement {
  const slide = host.querySelector<HTMLElement>('.slide');
  if (!slide) throw new Error('Slide element was not rendered');
  return slide;
}

describe('SlideComponent', () => {
  it('renders the title and highlights accent text parts', () => {
    const element = render(baseSlide);

    expect(element.querySelector('.slide__title')?.textContent).toContain('Test title');
    expect(element.querySelector('.slide__accent')?.textContent).toBe('35% off');
  });

  it('joins text parts without stray whitespace', () => {
    const text = render(baseSlide).querySelector('.slide__text')?.textContent;
    expect(text?.trim()).toBe('Up to 35% off: daily, weekly!');
  });

  it('applies the theme and alignment', () => {
    const slide = slideElement(render({...baseSlide, contentAlign: 'right', theme: 'orbit'}));

    expect(slide.dataset['theme']).toBe('orbit');
    expect(slide.classList).toContain('slide--right');
  });

  it('opens external links in a new tab, and says so', () => {
    const link = render({...baseSlide, buttonLink: 'https://example.com'}).querySelector('a.slide__button');
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
    expect(link?.textContent).toContain('opens in a new tab');
  });

  it('keeps plain links in the same tab', () => {
    const link = render({...baseSlide, buttonLink: '#roadmap'}).querySelector('a.slide__button');
    expect(link?.hasAttribute('target')).toBe(false);
  });

  it('turns /-links into in-app routes', () => {
    TestBed.configureTestingModule({providers: [provideRouter([])]});
    const link = render({...baseSlide, buttonLink: '/stories/latest/2026-09-20'}).querySelector('a.slide__button');
    expect(link?.getAttribute('href')).toBe('/stories/latest/2026-09-20');
    expect(link?.hasAttribute('target')).toBe(false);
  });

  it('shows photo slides without a floating visual, with kicker and credit', () => {
    const element = render({
      ...baseSlide,
      visualImage: null,
      kicker: '20 September 2026',
      credit: 'Public domain',
    });

    expect(element.querySelector('.slide--photo')).not.toBeNull();
    expect(element.querySelector('.slide__visual')).toBeNull();
    expect(element.querySelector('.slide__kicker')?.textContent).toBe('20 September 2026');
    expect(element.querySelector('.slide__credit')?.textContent).toBe('Public domain');
  });

  it('renders an honest disabled button when there is no link', () => {
    const button = render(baseSlide).querySelector('button.slide__button');
    expect(button?.getAttribute('aria-disabled')).toBe('true');
  });

  it('reserves image space and prioritises the first slide', () => {
    const images = [...render(baseSlide, true).querySelectorAll('img')];

    expect(images.every((image) => image.getAttribute('width') && image.getAttribute('height'))).toBe(true);
    expect(images.every((image) => image.getAttribute('fetchpriority') === 'high')).toBe(true);
  });
});
