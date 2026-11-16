import { useSyncExternalStore } from 'react';

export const ROUTES = ['home', 'bank', 'settings', 'dev'] as const;
export type Route = (typeof ROUTES)[number];

function current(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(hash) ? (hash as Route) : 'home';
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, current);
}

export function href(route: Route): string {
  return `#/${route}`;
}
