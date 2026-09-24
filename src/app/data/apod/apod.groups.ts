import type { ApodEntry } from './apod.model';

/** A story group, e.g. "Latest" or "Galaxies". Entries are newest first. */
export interface StoryGroup {
  readonly id: string;
  readonly title: string;
  readonly entries: readonly ApodEntry[];
}

interface Topic {
  readonly id: string;
  readonly title: string;
  readonly keywords: RegExp;
}

/**
 * Topics are matched against the title first, then the explanation, in this order.
 * Each entry joins the first topic that matches, so the groups don't repeat each other.
 */
const TOPICS: readonly Topic[] = [
  {
    id: 'solar-system',
    title: 'Solar System',
    keywords:
      /\b(sun|solar|moon|lunar|mercury|venus|mars|martian|jupiter|saturn|uranus|neptune|pluto|comet|asteroid|eclipse)\b/i,
  },
  {
    id: 'galaxies',
    title: 'Galaxies',
    keywords: /\b(galax(y|ies)|milky way|andromeda|quasar|black hole)\b/i,
  },
  {
    id: 'nebulae',
    title: 'Nebulae',
    keywords: /\b(nebula[es]?|supernova remnant|planetary nebula|molecular cloud)\b/i,
  },
  {
    id: 'stars',
    title: 'Stars',
    keywords: /\b(stars?|stellar|star cluster|supernova|pulsar|binary)\b/i,
  },
  {
    id: 'earth-sky',
    title: 'Earth & Sky',
    keywords: /\b(aurora|meteor|night sky|sky|horizon|atmosphere|satellite|rocket|iss|launch)\b/i,
  },
];

export const LATEST_GROUP_SIZE = 7;

function topicOf(entry: ApodEntry): Topic | null {
  return (
    TOPICS.find((topic) => topic.keywords.test(entry.title)) ??
    TOPICS.find((topic) => topic.keywords.test(entry.explanation)) ??
    null
  );
}

/**
 * Builds story groups: "Latest" (the newest entries) followed by topic groups,
 * ordered by their newest entry. Unmatched entries go to "More". Empty groups are omitted.
 */
export function groupStories(entries: readonly ApodEntry[]): StoryGroup[] {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  if (sorted.length === 0) return [];

  const buckets = new Map<string, { title: string; entries: ApodEntry[] }>();
  for (const entry of sorted) {
    const topic = topicOf(entry);
    const id = topic?.id ?? 'more';
    let bucket = buckets.get(id);
    if (!bucket) {
      bucket = { title: topic?.title ?? 'More', entries: [] };
      buckets.set(id, bucket);
    }
    bucket.entries.push(entry);
  }

  const topicGroups = [...buckets.entries()]
    .map(([id, bucket]) => ({ id, title: bucket.title, entries: bucket.entries }))
    // "More" always goes last; other groups by their newest entry.
    .sort((a, b) =>
      a.id === 'more' ? 1 : b.id === 'more' ? -1 : newest(b).localeCompare(newest(a)),
    );

  return [
    { id: 'latest', title: 'Latest', entries: sorted.slice(0, LATEST_GROUP_SIZE) },
    ...topicGroups,
  ];
}

function newest(group: { entries: readonly ApodEntry[] }): string {
  return group.entries[0]?.date ?? '';
}
