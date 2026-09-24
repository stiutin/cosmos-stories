import type {Routes} from '@angular/router';

import {Home} from './home/home';

export const routes: Routes = [
  {
    path: '',
    component: Home,
    title: 'Cosmos Stories',
    children: [
      {
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
  {path: '**', redirectTo: ''},
];
