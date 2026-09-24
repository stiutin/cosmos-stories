# @cosmos-stories/carousel

An accessible Angular carousel built on a **framework-agnostic engine**.

- **Seamless infinite loop**: clones plus an invisible jump, so the last slide never rewinds to the first.
- **Pointer gestures**: touch, mouse and pen, with flick velocity, axis locking and edge resistance when not looping.
- **Autoplay that respects people**: a pause button, progress, and pausing on hover, focus, drag and hidden tabs. It is off with `prefers-reduced-motion`.
- **WAI-ARIA carousel pattern**: `inert` off-screen slides, keyboard navigation, and polite announcements.
- **Horizontal or vertical**, signals-based, `OnPush`, zoneless-ready.

The package has two entry points:

| Import                          | Contents                                                        | Depends on |
| ------------------------------- | --------------------------------------------------------------- | ---------- |
| `@cosmos-stories/carousel/core` | `CarouselEngine`, `SwipeTracker`, `AutoplayClock`, loop helpers | nothing    |
| `@cosmos-stories/carousel`      | `<ui-carousel>`, `ng-template[uiCarouselSlide]`, `[uiSwipe]`    | Angular    |

## Angular usage

```ts
import {UiCarousel, UiCarouselSlide} from '@cosmos-stories/carousel';

@Component({
  imports: [UiCarousel, UiCarouselSlide],
  template: `
    <ui-carousel [items]="photos" label="Photos" [interval]="6000" [itemLabel]="photoLabel">
      <ng-template [uiCarouselSlide]="photos" let-photo let-active="active">
        <img [src]="photo.url" [alt]="photo.alt" />
      </ng-template>
    </ui-carousel>
  `,
})
export class Gallery {
  photos = [/* … */];
  photoLabel = (photo: Photo) => photo.alt;
}
```

Passing the items to `[uiCarouselSlide]` is optional. It only types `let-photo` as `Photo` instead of `unknown`.

### Inputs

| Input          | Default        | Description                                                      |
| -------------- | -------------- | ---------------------------------------------------------------- |
| `items`        | -              | The data to render, one slide per item                           |
| `label`        | `'Carousel'`   | Accessible name of the carousel region                           |
| `itemLabel`    | `Slide n`      | `(item, index) => string`, the accessible name of each indicator |
| `loop`         | `true`         | Wrap around seamlessly, or stop at the ends with edge resistance |
| `autoplay`     | `true`         | Whether autoplay starts playing (always off with reduced motion) |
| `interval`     | `10000`        | Autoplay cycle, ms                                               |
| `orientation`  | `'horizontal'` | `'horizontal'` or `'vertical'`                                   |
| `controls`     | `true`         | Built-in pause button and indicators                             |
| `transitionMs` | `380`          | Slide transition duration                                        |
| `easing`       | ease-out curve | Slide transition timing function                                 |
| `swipeOptions` | see core       | `deadzone`, `distanceRatio`, `flickVelocity`, `minFlickDistance` |

The slide template context provides `$implicit` (the item), `index`, `active` and `clone`.

### Custom controls

Set `[controls]="false"` and drive the carousel through its public API:

```html
<ui-carousel #carousel="uiCarousel" [items]="items" [controls]="false">…</ui-carousel>
<button (click)="carousel.prev()">Back</button>
<span>{{ carousel.index() + 1 }} / {{ carousel.count() }}</span>
<button (click)="carousel.next()">Forward</button>
```

Signals: `state`, `index`, `count`, `playing`, `progress`. `progress` is refreshed every 250 ms; the built-in bar is painted per frame without change detection. Methods: `next()`, `prev()`, `goTo(i)`, `toggleAutoplay()`. Output: `indexChange`.

### Theming

`--ui-carousel-control-color`, `--ui-carousel-control-muted`, `--ui-carousel-control-bg`, `--ui-carousel-focus-color`.

## Engine usage (any framework)

`CarouselEngine` holds no DOM references, timers or animation frames. You feed it commands and timestamps, and render its state.

```ts
import {CarouselEngine} from '@cosmos-stories/carousel/core';

const engine = new CarouselEngine({loop: true, interval: 5000});
engine.setCount(slides.length);
engine.subscribe((state) => render(state));
engine.tick(performance.now());
```

The renderer contract:

1. Translate the track by `-state.position` slides plus `state.dragOffset` px.
2. Animate only when `state.animate` is true and `state.phase !== 'dragging'`.
3. Call `engine.settle()` when the transition ends.
4. When `state.hasPending` becomes true, paint first, then call `engine.resolvePending()` on the next frame.
5. Render `state.renderedCount` items, using `withClones(items, loop)` to get the clones.

## Development

```bash
npm run test:lib        # engine + component tests
npm run test:coverage   # with a coverage report
npm run build:lib       # publishable package in dist/carousel
```
