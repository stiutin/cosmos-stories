import type { ApodApiItem } from './apod.parse';

/**
 * API-shaped test data. Texts are written for the tests; the structure and the
 * quirks (stray whitespace, `http:` URLs, multi-line credits, videos without
 * thumbnails, the `other` media type) mirror real APOD responses.
 */
export const RAW_ITEMS: readonly ApodApiItem[] = [
  {
    date: '2026-09-18',
    title: '  The Whirlpool Galaxy in Detail ',
    explanation: 'A spiral galaxy\nseen face-on, with   dust lanes.',
    media_type: 'image',
    url: 'https://apod.nasa.gov/apod/image/2609/whirlpool_1024.jpg',
    hdurl: 'https://apod.nasa.gov/apod/image/2609/whirlpool.jpg',
  },
  {
    date: '2026-09-19',
    title: 'Saturn at Opposition',
    explanation: 'The ringed planet is closest to Earth this week.',
    media_type: 'image',
    url: 'http://apod.nasa.gov/apod/image/2609/saturn_1024.jpg',
    copyright: '\nJane Astronomer\n',
  },
  {
    date: '2026-09-20',
    title: 'A Launch Seen From Orbit',
    explanation: 'A rocket plume photographed by astronauts.',
    media_type: 'video',
    url: 'https://www.youtube.com/embed/abc123?rel=0',
    thumbnail_url: 'https://img.youtube.com/vi/abc123/0.jpg',
  },
  {
    date: '2026-09-21',
    title: 'Interactive Sky Map',
    explanation: 'An interactive page rather than an image.',
    media_type: 'other',
  },
  {
    date: '2026-09-22',
    title: 'The Helix Nebula',
    explanation: 'A planetary nebula about 650 light-years away.',
    media_type: 'image',
    url: 'https://apod.nasa.gov/apod/image/2609/helix_1024.jpg',
  },
  {
    date: 'not-a-date',
    title: 'Broken',
    explanation: 'x',
    media_type: 'image',
    url: 'https://a.b/c.jpg',
  },
  {
    date: '2026-09-23',
    title: '',
    explanation: 'No title',
    media_type: 'image',
    url: 'https://a.b/c.jpg',
  },
];
