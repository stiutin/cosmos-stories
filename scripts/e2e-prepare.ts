/**
 * Turns the production build into what the end-to-end tests expect:
 * - 404.html for deep links, as on GitHub Pages;
 * - the fixture snapshot as data/apod.json, so even requests the tests can't
 *   intercept (e.g. from the service worker) see deterministic data;
 * - static story pages, as the deploy job builds them.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { writeStoryPages } from './story-pages.ts';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist', 'cosmos-stories', 'browser');

await copyFile(join(DIST, 'index.html'), join(DIST, '404.html'));
await mkdir(join(DIST, 'data'), { recursive: true });
await copyFile(join(ROOT, 'e2e', 'fixtures', 'apod.json'), join(DIST, 'data', 'apod.json'));
await writeStoryPages(DIST);
console.log('✔ Build prepared for end-to-end tests');
