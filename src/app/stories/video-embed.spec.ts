import {toEmbedUrl} from './video-embed';

describe('toEmbedUrl', () => {
  it('uses privacy-enhanced YouTube embeds that autoplay', () => {
    expect(toEmbedUrl('https://www.youtube.com/embed/abc?rel=0')).toBe(
      'https://www.youtube-nocookie.com/embed/abc?rel=0&autoplay=1'
    );
  });

  it('allows Vimeo', () => {
    expect(toEmbedUrl('https://player.vimeo.com/video/1')).toBe('https://player.vimeo.com/video/1?autoplay=1');
  });

  it('rejects unknown hosts, plain http and invalid urls', () => {
    expect(toEmbedUrl('https://evil.example/embed')).toBeNull();
    expect(toEmbedUrl('http://www.youtube.com/embed/abc')).toBeNull();
    expect(toEmbedUrl('not a url')).toBeNull();
  });
});
