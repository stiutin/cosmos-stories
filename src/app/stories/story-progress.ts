import {Component, computed, input} from '@angular/core';

@Component({
  selector: 'app-story-progress',
  template: `
    @for (segment of segments(); track $index) {
      <span class="segment" [class.segment--current]="$index === index()">
        <span class="segment__fill" [style.transform]="'scaleX(' + segment + ')'"></span>
      </span>
    }
  `,
  styles: `
    :host {
      display: flex;
      gap: 4px;
    }
    .segment {
      background: rgba(255, 255, 255, 0.35);
      border-radius: 2px;
      flex: 1;
      height: 3px;
      overflow: hidden;
    }
    .segment__fill {
      background: #fff;
      display: block;
      height: 100%;
      transform-origin: left center;
    }
  `,
  host: {'aria-hidden': 'true'},
})
export class StoryProgress {
  public readonly count = input.required<number>();
  public readonly index = input.required<number>();
  public readonly progress = input(0);

  protected readonly segments = computed(() =>
    Array.from({length: this.count()}, (_, i) => (i < this.index() ? 1 : i === this.index() ? this.progress() : 0))
  );
}
