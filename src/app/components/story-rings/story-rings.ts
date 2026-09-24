import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { StoryGroup } from '../../data/apod/apod.groups';
import { coverAtLeast } from '../../data/apod/apod.media';
import { SeenStoriesService } from '../../stories/seen-stories.service';
import { STORY_COVER_TRANSITION, StoryTransitionService } from '../../stories/story-transition';

interface Ring {
  readonly id: string;
  readonly title: string;
  readonly cover: string | null;
  /** Where the ring opens the player: the first story not seen yet. */
  readonly startDate: string;
  readonly count: number;
  readonly seen: boolean;
}

/**
 * A horizontally scrolling row of story groups, Instagram style: groups with new
 * stories come first with a colourful ring, fully seen groups follow in grey.
 */
@Component({
  selector: 'app-story-rings',
  imports: [RouterLink],
  templateUrl: './story-rings.html',
  styleUrl: './story-rings.scss',
})
export class StoryRings {
  private readonly seenStories = inject(SeenStoriesService);
  protected readonly transition = inject(StoryTransitionService);

  readonly groups = input.required<readonly StoryGroup[]>();
  /** Off while the player is open: only one element may carry the transition name. */
  readonly transitionsEnabled = input(true);

  protected readonly coverTransition = STORY_COVER_TRANSITION;
  protected readonly placeholders = [1, 2, 3, 4, 5, 6];

  protected readonly rings = computed<Ring[]>(() => {
    this.seenStories.seen(); // re-evaluate when something is seen
    const rings = this.groups().flatMap((group) => {
      const first = group.entries[0];
      if (!first) return [];
      const start = group.entries[this.seenStories.firstUnseenIndex(group)] ?? first;
      return [
        {
          id: group.id,
          title: group.title,
          // 64 px avatars on 2× screens: the 160 px variant is plenty.
          cover: coverAtLeast(first, 128),
          startDate: start.date,
          count: group.entries.length,
          seen: this.seenStories.isGroupSeen(group),
        },
      ];
    });
    // Stable sort: unseen groups first, each part keeps its original order.
    return [...rings.filter((ring) => !ring.seen), ...rings.filter((ring) => ring.seen)];
  });
}
