import {createReadStream, existsSync, readFileSync} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, join, normalize} from 'node:path';
import {createGzip} from 'node:zlib';

const ROOT = join(import.meta.dirname, '..', 'dist', 'cosmos-stories', 'browser');
const BASE = '/cosmos-stories/';
const PORT = Number(process.env.PORT ?? 4400);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
};

function assertPreparedBuild(): void {
  const problems: string[] = [];
  const index = join(ROOT, 'index.html');

  if (!existsSync(index)) {
    problems.push('there is no production build');
  } else if (!readFileSync(index, 'utf8').includes(`<base href="${BASE}">`)) {
    problems.push(`the build's base href isn't ${BASE} (was it built with plain \`npm run build\`?)`);
  }

  if (!existsSync(join(ROOT, '404.html')) || !existsSync(join(ROOT, 'data', 'apod.json'))) {
    problems.push('the build was not prepared for end-to-end tests');
  }

  if (problems.length === 0) return;

  console.error(
    `✖ Can't serve ${ROOT}: ${problems.join('; ')}.\n` +
      '  Run `npm run e2e` (builds, then tests) or `npm run e2e:build` before `npm run e2e:run`.'
  );
  process.exit(1);
}

assertPreparedBuild();

createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (!url.pathname.startsWith(BASE)) {
      response.writeHead(404, {'content-type': 'text/plain'}).end('Not found');
      return;
    }

    const relative = normalize(decodeURIComponent(url.pathname.slice(BASE.length)) || 'index.html');
    let file = join(ROOT, '404.html');
    let status = 404;

    for (const candidate of [join(ROOT, relative), join(ROOT, `${relative}.html`)]) {
      if (!candidate.startsWith(ROOT)) continue;

      const info = await stat(candidate).catch(() => null);

      if (info?.isFile()) {
        file = candidate;
        status = 200;
        break;
      }
    }
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    const compressible = /text|javascript|json|svg|manifest/.test(type);
    const gzip = compressible && /\bgzip\b/.test(String(request.headers['accept-encoding']));
    response.writeHead(status, {
      'content-type': type,
      ...(gzip ? {'content-encoding': 'gzip', vary: 'accept-encoding'} : {}),
    });
    const stream = createReadStream(file);

    if (gzip) {
      stream.pipe(createGzip()).pipe(response);
    } else {
      stream.pipe(response);
    }
  })();
}).listen(PORT, () => {
  console.log(`Serving ${ROOT} at http://localhost:${PORT}${BASE}`);
});
