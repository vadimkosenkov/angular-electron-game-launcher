import { Routes } from '@angular/router';

/**
 * Every page is loaded on demand. It buys little at this size, but it is the
 * shape that keeps paying as the application grows, and it keeps the initial
 * bundle to the shell.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'discover' },
  {
    path: 'discover',
    loadComponent: () => import('./features/discover/discover').then((m) => m.Discover),
  },
  {
    path: 'favourites',
    loadComponent: () => import('./features/favourites/favourites').then((m) => m.Favourites),
  },
  {
    path: 'games/:id',
    loadComponent: () => import('./features/game/game-page').then((m) => m.GamePage),
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
  },
  {
    path: 'diagnostics',
    loadComponent: () => import('./features/diagnostics/diagnostics').then((m) => m.Diagnostics),
  },
  // An unknown address is a mistake, not a destination: send it to the catalog.
  { path: '**', redirectTo: 'discover' },
];
