import {RAW_ITEMS} from './apod.fixtures';
import {
  apodPageUrl,
  isIsoDate,
  isSafeMediaUrl,
  normalizeApodItem,
  normalizeApodResponse,
  parseSnapshot,
} from './apod.parse';

describe('isIsoDate', () => {
  it('accepts real calendar dates only', () => {
    expect(isIsoDate('2026-09-23')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-9-3')).toBe(false);
    expect(isIsoDate(20260923)).toBe(false);
  });
});

describe('apodPageUrl', () => {
  it('builds the apod.nasa.gov page for a date', () => {
    expect(apodPageUrl('2026-09-21')).toBe('https://apod.nasa.gov/apod/ap260921.html');
  });
});

describe('normalizeApodResponse', () => {
  const {entries, skipped} = normalizeApodResponse(RAW_ITEMS);

  it('keeps valid public-domain entries, newest first', () => {
    expect(entries.map((entry) => entry.date)).toEqual(['2026-09-22', '2026-09-20', '2026-09-18']);
  });

  it('cleans up whitespace in text', () => {
    const galaxy = entries.find((entry) => entry.date === '2026-09-18');
    expect(galaxy?.title).toBe('The Whirlpool Galaxy in Detail');
    expect(galaxy?.explanation).toBe('A spiral galaxy seen face-on, with dust lanes.');
  });

  it('maps images and videos to typed media', () => {
    expect(entries.find((entry) => entry.date === '2026-09-18')?.media).toEqual({
      kind: 'image',
      url: 'https://apod.nasa.gov/apod/image/2609/whirlpool_1024.jpg',
      hdUrl: 'https://apod.nasa.gov/apod/image/2609/whirlpool.jpg',
    });
    expect(entries.find((entry) => entry.date === '2026-09-20')?.media).toEqual({
      kind: 'video',
      embedUrl: 'https://www.youtube.com/embed/abc123?rel=0',
      thumbnailUrl: 'https://img.youtube.com/vi/abc123/0.jpg',
    });
  });

  it('explains every skipped item', () => {
    expect(skipped).toEqual([
      {date: '2026-09-19', reason: 'copyrighted media'},
      {date: '2026-09-21', reason: 'unsupported media type: other'},
      {date: null, reason: 'missing or invalid date'},
      {date: '2026-09-23', reason: 'missing title'},
    ]);
  });

  it('can include copyrighted media with a cleaned-up credit and https url', () => {
    const saturn = normalizeApodResponse(RAW_ITEMS, {includeCopyrighted: true}).entries.find(
      (entry) => entry.date === '2026-09-19'
    );
    expect(saturn?.copyright).toBe('Jane Astronomer');
    expect(saturn?.media).toMatchObject({
      url: 'https://apod.nasa.gov/apod/image/2609/saturn_1024.jpg',
    });
  });

  it('accepts a single object and de-duplicates dates', () => {
    const [first] = RAW_ITEMS;
    expect(normalizeApodResponse(first).entries).toHaveLength(1);
    expect(normalizeApodResponse([first, first]).entries).toHaveLength(1);
  });

  it('skips non-objects', () => {
    expect(normalizeApodResponse([null, 'x']).skipped).toHaveLength(2);
  });
});

describe('normalizeApodItem', () => {
  const base = {date: '2026-01-01', title: 'T', explanation: 'E'};

  it('rejects media without a usable url', () => {
    expect(normalizeApodItem({...base, media_type: 'image', url: 'ftp://x/y.jpg'})).toEqual({
      date: '2026-01-01',
      reason: 'image without a valid url',
    });
    expect(normalizeApodItem({...base, media_type: 'video', url: 'not a url'})).toEqual({
      date: '2026-01-01',
      reason: 'video without a valid url',
    });
  });

  it('rejects entries without an explanation', () => {
    expect(normalizeApodItem({...base, explanation: '  '})).toMatchObject({
      reason: 'missing explanation',
    });
  });

  it('keeps a video without a thumbnail', () => {
    const entry = normalizeApodItem({...base, media_type: 'video', url: 'https://v.example/1'});
    expect(entry).toMatchObject({media: {kind: 'video', thumbnailUrl: null}});
  });
});

describe('isSafeMediaUrl', () => {
  it('accepts https urls and same-origin relative paths', () => {
    expect(isSafeMediaUrl('https://apod.nasa.gov/a.jpg')).toBe(true);
    expect(isSafeMediaUrl('slides/nebula-visual.svg')).toBe(true);
  });

  it('rejects other schemes, protocol-relative urls and path traversal', () => {
    expect(isSafeMediaUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeMediaUrl('http://insecure.example/a.jpg')).toBe(false);
    expect(isSafeMediaUrl('//evil.example/a.jpg')).toBe(false);
    expect(isSafeMediaUrl('../secret.svg')).toBe(false);
    expect(isSafeMediaUrl('/absolute/path.svg')).toBe(false);
  });
});

describe('parseSnapshot', () => {
  const {entries} = normalizeApodResponse(RAW_ITEMS);
  const snapshot = {generatedAt: '2026-09-23T06:15:00.000Z', isSample: false, entries};

  it('round-trips a snapshot written by the script', () => {
    expect(parseSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  });

  it('drops invalid entries but keeps the valid ones', () => {
    const tampered = {
      ...snapshot,
      entries: [...entries, {date: '2026-09-24', title: 'x'}, null],
    };
    expect(parseSnapshot(tampered).entries).toHaveLength(entries.length);
  });

  it('rejects media with unsafe urls', () => {
    const [first] = entries;
    const unsafe = {...first, media: {kind: 'image', url: 'javascript:alert(1)', hdUrl: null}};
    expect(() => parseSnapshot({entries: [unsafe]})).toThrow('no valid entries');
  });

  it('fails clearly on unusable input', () => {
    expect(() => parseSnapshot(null)).toThrow('not an object');
    expect(() => parseSnapshot({})).toThrow('no entries array');
    expect(() => parseSnapshot({entries: []})).toThrow('no valid entries');
  });

  it('defaults metadata fields', () => {
    expect(parseSnapshot({entries})).toMatchObject({generatedAt: '', isSample: false});
  });
});

describe('parseSnapshot covers', () => {
  const base = normalizeApodResponse(RAW_ITEMS).entries[0];
  const cover = {
    width: 2000,
    height: 1000,
    variants: [
      {width: 960, avif: 'data/img/a-960.avif', webp: 'data/img/a-960.webp'},
      {width: 160, avif: 'data/img/a-160.avif', webp: 'data/img/a-160.webp'},
    ],
  };

  it('keeps valid optimised variants, sorted by width', () => {
    const parsed = parseSnapshot({entries: [{...base, cover}]}).entries[0];
    expect(parsed?.cover?.variants.map((variant) => variant.width)).toEqual([160, 960]);
  });

  it('drops malformed or unsafe covers instead of the entry', () => {
    const unsafe = {
      ...cover,
      variants: [{width: 160, avif: 'javascript:alert(1)', webp: 'data/img/a.webp'}],
    };
    for (const bad of [unsafe, {...cover, width: 0}, {...cover, variants: []}, 'x']) {
      const parsed = parseSnapshot({entries: [{...base, cover: bad}]}).entries[0];
      expect(parsed?.cover).toBeNull();
    }
  });
});
