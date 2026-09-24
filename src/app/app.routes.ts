import type { Routes } from '@angular/router';
import { Home } from './home/home';

export const routes: Routes = [
  {
    path: '',
    component: Home,
    title: 'Cosmos Stories',
    children: [
      {
        // The player is a child route: it opens over the home page, which stays alive
        // underneath, and every story has a shareable URL.
        path: 'stories/:groupId/:date',
        loadComponent: () => import('./stories/stories-player').then((m) => m.StoriesPlayer),
        title: 'Stories · Cosmos Stories',
      },
    ],
  },
  {
    path: 'playground',
    loadComponent: () => import('./playground/playground').then((m) => m.Playground),
    title: 'Carousel playground · Cosmos Stories',
  },
  { path: '**', redirectTo: '' },
];
