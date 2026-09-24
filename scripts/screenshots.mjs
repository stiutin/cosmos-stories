import {spawn, spawnSync} from 'node:child_process';
import {copyFileSync, mkdirSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';

import {chromium, devices} from '@playwright/test';

const OUT = '.github/screenshots';
const live = process.env.BASE_URL;
const base = (live ?? 'http://localhost:4400/cosmos-stories/').replace(/\/?$/, '/');
mkdirSync(OUT, {recursive: true});

let server;
if (!live) {
  const built = spawnSync('npm', ['run', 'e2e:build'], {shell: true, stdio: 'inherit'});
  if (built.status !== 0) {
    process.exit(built.status ?? 1);
  }
  copyFileSync('e2e/fixtures/showcase.json', 'dist/cosmos-stories/browser/data/apod.json');
  spawnSync(process.execPath, ['scripts/story-pages.ts'], {stdio: 'inherit'});
  server = spawn(process.execPath, ['e2e/serve.ts'], {stdio: 'ignore'});
  for (
    let attempt = 0;
    attempt < 50 &&
    !(await fetch(base).then(
      () => true,
      () => false
    ));
    attempt++
  ) {
    await sleep(100);
  }
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? {args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH} : {}
);

async function shoot(contextOptions, path, name, prepare = async () => {}) {
  const context = await browser.newContext({...contextOptions, reducedMotion: 'reduce'});
  const page = await context.newPage();
  await page.goto(new URL(path, base).toString());
  await page.waitForLoadState('networkidle');
  await prepare(page);
  await page.mouse.move(1, 1);
  await page.screenshot({path: `${OUT}/${name}.png`});
  await context.close();
  console.log(`✔ ${name}.png`);
}

const desktop = {viewport: {width: 1440, height: 900}};
const phone = {...devices['Pixel 7'], deviceScaleFactor: 2};

await shoot(desktop, '.', 'home');
await shoot(desktop, 'stories/latest/2026-09-21', 'player');
await shoot(desktop, 'playground', 'playground');
await shoot(phone, '.', 'home-mobile');
await shoot(phone, 'stories/latest/2026-09-22', 'story-mobile');

await browser.close();
server?.kill();
