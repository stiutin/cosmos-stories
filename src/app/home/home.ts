import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import { CarouselComponent } from '../components/carousel/carousel';
import { StoryRings } from '../components/story-rings/story-rings';
import { ApodService } from '../data/apod/apod.service';

@Component({
  selector: 'app-home',
  imports: [CarouselComponent, StoryRings, RouterOutlet, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly apod = inject(ApodService);
  /** While the stories player is open, the page behind it is inert and its carousel paused. */
  protected readonly playerOpen = signal(false);

  /**
   * A shared story link opens straight into the player, which covers the page. The rings
   * and banner behind it are then rendered only when the player closes: their work
   * would otherwise compete with the story's first paint for no visible benefit.
   * (Rendering them "when idle" was measured too: it still landed inside the page's
   * busiest second and doubled Total Blocking Time.)
   */
  protected readonly showContent = signal(inject(ActivatedRoute).snapshot.firstChild === null);

  protected onPlayerClosed(): void {
    this.playerOpen.set(false);
    this.showContent.set(true);
  }
}
