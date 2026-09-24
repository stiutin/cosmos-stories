/**
 * Writes a copy of index.html for every story in the snapshot, as
 * `stories/<group>/<date>.html`. GitHub Pages serves `/stories/<group>/<date>` from
 * that file with **200 OK**, so shared story links load like any page: crawlers,
 * link previews and Lighthouse see a real page instead of the 404.html fallback.
 * Links to stories that are no longer in the snapshot still work through 404.html.
 *
 *   node scripts/story-pages.ts [dist/cosmos-stories/browser]
 */
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { groupStories } from '../src/app/data/apod/apod.groups.ts';
import { parseSnapshot } from '../src/app/data/apod/apod.parse.ts';

export async function writeStoryPages(dist: string): Promise<number> {
  const snapshot = parseSnapshot(
    JSON.parse(await readFile(join(dist, 'data', 'apod.json'), 'utf8')),
  );
  const index = join(dist, 'index.html');
  let count = 0;

  for (const group of groupStories(snapshot.entries)) {
    const dir = join(dist, 'stories', group.id);
    await mkdir(dir, { recursive: true });
    for (const entry of group.entries) {
      await copyFile(index, join(dir, `${entry.date}.html`));
      count++;
    }
  }
  return count;
}

if (import.meta.main) {
  const dist = resolve(process.argv[2] ?? 'dist/cosmos-stories/browser');
  const count = await writeStoryPages(dist);
  console.log(`✔ ${count} story pages written`);
}
