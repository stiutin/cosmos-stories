import {appendFile, copyFile, mkdir, rm, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import type {ApodSnapshot} from '../src/app/data/apod/apod.model.ts';
import type {NormalizeResult} from '../src/app/data/apod/apod.parse.ts';
import {normalizeApodResponse, parseSnapshot} from '../src/app/data/apod/apod.parse.ts';
import {optimizeImages} from './optimize-images.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'public/data/apod.json');
const SAMPLE = resolve(ROOT, 'data/apod.sample.json');
const IMAGES_DIR = resolve(ROOT, 'public/data/img');

const API_URL = process.env.APOD_API_URL ?? 'https://api.nasa.gov/planetary/apod';
const API_KEY = process.env.NASA_API_KEY?.trim() ?? '';
const FALLBACK_URL = process.env.APOD_FALLBACK_URL?.trim() ?? '';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = Number(process.env.APOD_RETRY_BASE_MS ?? 2_000);
const MIN_ENTRIES = 7;

interface Options {
  readonly days: number;
  readonly includeCopyrighted: boolean;
  readonly strict: boolean;
  readonly images: boolean;
}

class HttpError extends Error {
  public readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const inActions = process.env.GITHUB_ACTIONS === 'true';

function redact(message: string): string {
  return API_KEY ? message.replaceAll(API_KEY, '***') : message;
}

function log(message: string): void {
  console.log(redact(message));
}

function warn(message: string): void {
  console.warn(redact(inActions ? `::warning::${message}` : `⚠ ${message}`));
}

async function summary(markdown: string): Promise<void> {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) await appendFile(file, `${markdown}\n`);
}

function parseArgs(argv: readonly string[]): Options {
  const days = Number(argv.find((arg) => arg.startsWith('--days='))?.split('=')[1] ?? 90);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error('--days must be an integer between 1 and 365');
  }
  return {
    days,
    includeCopyrighted: argv.includes('--include-copyrighted'),
    strict: argv.includes('--strict'),
    images: !argv.includes('--no-images'),
  };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number, from = new Date()): string {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() - days);
  return isoDate(date);
}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

async function getJson(url: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
      if (response.ok) return await response.json();

      const body = (await response.text()).slice(0, 300);
      const error = new HttpError(response.status, `HTTP ${response.status}: ${body}`);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt >= MAX_ATTEMPTS) throw error;
      warn(`${error.message} (attempt ${attempt}/${MAX_ATTEMPTS}), retrying…`);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (attempt >= MAX_ATTEMPTS) throw error;
      warn(`${String(error)} (attempt ${attempt}/${MAX_ATTEMPTS}), retrying…`);
    }
    await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
  }
}

async function fromApi(options: Options): Promise<NormalizeResult> {
  const request = (endDate: string): Promise<unknown> => {
    const url = new URL(API_URL);
    url.searchParams.set('api_key', API_KEY);
    url.searchParams.set('start_date', daysAgo(options.days - 1));
    url.searchParams.set('end_date', endDate);
    url.searchParams.set('thumbs', 'true');
    return getJson(url.toString());
  };

  let raw: unknown;

  try {
    raw = await request(isoDate(new Date()));
  } catch (error) {
    if (!(error instanceof HttpError) || (error.status !== 400 && error.status !== 404)) throw error;

    warn("Today's entry isn't available yet; requesting up to yesterday.");
    raw = await request(daysAgo(1));
  }

  const result = normalizeApodResponse(raw, {includeCopyrighted: options.includeCopyrighted});
  if (result.entries.length < MIN_ENTRIES) {
    throw new Error(`Only ${result.entries.length} usable entries (minimum ${MIN_ENTRIES})`);
  }

  return result;
}

async function fromFallback(options: Options): Promise<ApodSnapshot> {
  const snapshot = parseSnapshot(await getJson(FALLBACK_URL));

  if (options.strict && snapshot.isSample) throw new Error('the fallback snapshot is sample data');

  return snapshot;
}

async function write(snapshot: ApodSnapshot): Promise<void> {
  await mkdir(dirname(OUTPUT), {recursive: true});
  await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
}

function describeSkipped(result: NormalizeResult): string {
  const counts = new Map<string, number>();

  for (const {reason} of result.skipped) counts.set(reason, (counts.get(reason) ?? 0) + 1);

  return [...counts].map(([reason, count]) => `${count} × ${reason}`).join(', ') || 'none';
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (API_KEY) {
    try {
      const result = await fromApi(options);
      let entries = result.entries;
      let imageSummary = 'Images: hot-linked from apod.nasa.gov (`--no-images`).';

      if (options.images) {
        await rm(IMAGES_DIR, {recursive: true, force: true});
        const report = await optimizeImages(entries, {
          outDir: IMAGES_DIR,
          publicPath: 'data/img',
          log: (message) => {
            warn(`Image skipped, ${message}`);
          },
        });
        entries = report.entries;
        const saved = report.originalBytes ? Math.round((1 - report.optimizedBytes / report.originalBytes) * 100) : 0;
        imageSummary =
          `Images: ${report.optimized} optimised to AVIF/WebP, ${report.failed} failed` +
          (report.optimized > 0 ? `; a 960 px WebP is on average ${saved}% smaller than the original.` : '.');
        log(`✔ ${imageSummary}`);
      }

      await write({generatedAt: new Date().toISOString(), isSample: false, entries});

      const newest = entries[0]?.date ?? '-';
      log(`✔ ${entries.length} entries (newest ${newest}); skipped: ${describeSkipped(result)}`);
      await summary(
        `### APOD snapshot\n\n${entries.length} entries, newest **${newest}**.\n\nSkipped: ${describeSkipped(result)}.\n\n${imageSummary}`
      );
      return;
    } catch (error) {
      warn(`NASA APOD API failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    warn('NASA_API_KEY is not set.');
  }

  if (FALLBACK_URL) {
    try {
      const fallback = await fromFallback(options);
      const snapshot = {
        ...fallback,
        entries: fallback.entries.map((entry) => ({...entry, cover: null})),
      };
      await write(snapshot);
      warn(`Reused the previous snapshot (${snapshot.entries.length} entries) from the fallback URL.`);
      await summary('### APOD snapshot\n\n⚠ API unavailable, the previous snapshot was reused.');
      return;
    } catch (error) {
      warn(`Fallback snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (options.strict) {
    throw new Error('No real APOD data available and --strict forbids the sample.');
  }
  await mkdir(dirname(OUTPUT), {recursive: true});
  await copyFile(SAMPLE, OUTPUT);
  warn('Using the bundled sample data.');
}

main().catch((error: unknown) => {
  console.error(redact(`✖ ${error instanceof Error ? error.message : String(error)}`));
  process.exitCode = 1;
});
