import { makeEntry } from './apod.testing';
import { coverAtLeast, coverImage, coverSources } from './apod.media';

const cover = {
  width: 2000,
  height: 1000,
  variants: [
    { width: 160, avif: 'data/img/a-160.avif', webp: 'data/img/a-160.webp' },
    { width: 960, avif: 'data/img/a-960.avif', webp: 'data/img/a-960.webp' },
  ],
};

describe('cover helpers', () => {
  it('builds AVIF and WebP srcsets, AVIF first', () => {
    expect(coverSources(makeEntry('2026-09-20', { cover }))).toEqual([
      { type: 'image/avif', srcset: 'data/img/a-160.avif 160w, data/img/a-960.avif 960w' },
      { type: 'image/webp', srcset: 'data/img/a-160.webp 160w, data/img/a-960.webp 960w' },
    ]);
  });

  it('has no sources without optimised variants', () => {
    expect(coverSources(makeEntry('2026-09-20'))).toEqual([]);
  });

  it('picks a small variant for avatars, falling back to the original', () => {
    expect(coverAtLeast(makeEntry('2026-09-20', { cover }), 200)).toBe('data/img/a-960.webp');
    expect(coverAtLeast(makeEntry('2026-09-20', { cover }), 100)).toBe('data/img/a-160.webp');
    const plain = makeEntry('2026-09-20');
    expect(coverAtLeast(plain, 100)).toBe(coverImage(plain));
  });
});
