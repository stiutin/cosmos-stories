import {Component, inject, signal} from '@angular/core';
import {ActivatedRoute, RouterLink, RouterOutlet} from '@angular/router';

import {CarouselComponent} from '../components/carousel/carousel';
import {StoryRings} from '../components/story-rings/story-rings';
import {ApodService} from '../data/apod/apod.service';

@Component({
  selector: 'app-home',
  imports: [CarouselComponent, StoryRings, RouterOutlet, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly apod = inject(ApodService);

  protected readonly playerOpen = signal(false);
  protected readonly showContent = signal(inject(ActivatedRoute).snapshot.firstChild === null);

  protected onPlayerClosed(): void {
    this.playerOpen.set(false);
    this.showContent.set(true);
  }
}
