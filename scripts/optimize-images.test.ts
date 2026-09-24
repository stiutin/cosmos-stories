import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import sharp from 'sharp';
import type { ApodEntry } from '../src/app/data/apod/apod.model.ts';
import { optimizeImages, WIDTHS } from './optimize-images.ts';

function entry(date: string, url: string | null, kind: 'image' | 'video' = 'image'): ApodEntry {
  return {
    date,
    title: date,
    explanation: 'x',
    media:
      kind === 'image'
        ? { kind, url: url ?? '', hdUrl: null }
        : { kind, embedUrl: 'https://www.youtube.com/embed/x', thumbnailUrl: url },
    copyright: null,
    pageUrl: 'https://apod.nasa.gov/apod/astropix.html',
    cover: null,
  };
}

let dir = '';
let jpeg: Uint8Array;
let small: Uint8Array;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'apod-img-'));
  const make = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: '#224488' } })
      .jpeg()
      .toBuffer();
  jpeg = new Uint8Array(await make(2000, 1200));
  small = new Uint8Array(await make(600, 400));
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

void test('writes AVIF and WebP at every width and records them', async () => {
  const report = await optimizeImages([entry('2026-09-20', 'https://x/big.jpg')], {
    outDir: dir,
    publicPath: 'data/img',
    fetchImage: () => Promise.resolve(jpeg),
  });

  const cover = report.entries[0]?.cover;
  assert.ok(cover);
  assert.equal(report.optimized, 1);
  assert.deepEqual(
    cover.variants.map((v) => v.width),
    [...WIDTHS],
  );
  assert.equal(cover.width, 2000);
  assert.equal(cover.height, 1200);
  assert.equal(cover.variants[0]?.avif, 'data/img/2026-09-20-160.avif');
  assert.ok(report.optimizedBytes < report.originalBytes);

  const files = await readdir(dir);
  assert.equal(files.filter((file) => file.startsWith('2026-09-20')).length, WIDTHS.length * 2);
});

void test('never upscales a small original', async () => {
  const report = await optimizeImages([entry('2026-09-19', 'https://x/small.jpg')], {
    outDir: dir,
    publicPath: 'data/img',
    fetchImage: () => Promise.resolve(small),
  });
  assert.deepEqual(
    report.entries[0]?.cover?.variants.map((v) => v.width),
    [160, 480, 600],
  );
});

void test('uses video posters and skips entries without any picture', async () => {
  const report = await optimizeImages(
    [entry('2026-09-18', 'https://x/poster.jpg', 'video'), entry('2026-09-17', null, 'video')],
    { outDir: dir, publicPath: 'data/img', fetchImage: () => Promise.resolve(jpeg) },
  );
  assert.ok(report.entries[0]?.cover);
  assert.equal(report.entries[1]?.cover, null);
  assert.equal(report.failed, 0);
});

void test('keeps going when a download or decode fails', async () => {
  const messages: string[] = [];
  const report = await optimizeImages(
    [entry('2026-09-16', 'https://x/broken.jpg'), entry('2026-09-15', 'https://x/ok.jpg')],
    {
      outDir: dir,
      publicPath: 'data/img',
      fetchImage: (url) =>
        Promise.resolve(url.includes('broken') ? new Uint8Array([1, 2, 3]) : jpeg),
      log: (message) => messages.push(message),
    },
  );
  assert.equal(report.failed, 1);
  assert.equal(report.entries[0]?.cover, null);
  assert.ok(report.entries[1]?.cover);
  assert.match(messages[0] ?? '', /^2026-09-16:/);
});
