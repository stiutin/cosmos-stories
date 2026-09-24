import {copyFile, mkdir} from 'node:fs/promises';
import {join, resolve} from 'node:path';

import {writeStoryPages} from './story-pages.ts';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist', 'cosmos-stories', 'browser');

await copyFile(join(DIST, 'index.html'), join(DIST, '404.html'));
await mkdir(join(DIST, 'data'), {recursive: true});
await copyFile(join(ROOT, 'e2e', 'fixtures', 'apod.json'), join(DIST, 'data', 'apod.json'));
await writeStoryPages(DIST);
console.log('✔ Build prepared for end-to-end tests');
