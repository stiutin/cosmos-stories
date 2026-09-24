import {access, copyFile, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'public/data/apod.json');

try {
  await access(OUTPUT);
} catch {
  await mkdir(dirname(OUTPUT), {recursive: true});
  await copyFile(resolve(ROOT, 'data/apod.sample.json'), OUTPUT);
  console.log('ℹ Using sample APOD data. Run `npm run data:fetch` with NASA_API_KEY for real data.');
}
