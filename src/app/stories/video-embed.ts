const ALLOWED_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com']);

export function toEmbedUrl(url: string): string | null {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) return null;

  if (parsed.hostname.endsWith('youtube.com')) parsed.hostname = 'www.youtube-nocookie.com';

  parsed.searchParams.set('autoplay', '1');

  return parsed.toString();
}
