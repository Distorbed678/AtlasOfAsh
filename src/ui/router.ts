import { useSyncExternalStore } from 'react';
import { SKILL_IDS } from '../engine/content';
import type { SkillId } from '../engine/content/types';

export type Route =
  | { page: 'overview' }
  | { page: 'skill'; skillId: SkillId }
  | { page: 'bank' }
  | { page: 'town' }
  | { page: 'workers' }
  | { page: 'settings' }
  | { page: 'dev' };

const SIMPLE = ['overview', 'bank', 'town', 'workers', 'settings', 'dev'] as const;

/** `skill.mining` ↔ `#/skill/mining` */
export function skillSlug(skillId: SkillId): string {
  return skillId.slice('skill.'.length);
}

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'skill') {
    const skillId = `skill.${parts[1]}` as SkillId;
    if (SKILL_IDS.includes(skillId)) return { page: 'skill', skillId };
  }
  const page = parts[0] as (typeof SIMPLE)[number];
  return SIMPLE.includes(page) ? ({ page } as Route) : { page: 'overview' };
}

let cachedHash = '';
let cachedRoute: Route = { page: 'overview' };
function current(): Route {
  if (window.location.hash !== cachedHash) {
    cachedHash = window.location.hash;
    cachedRoute = parse(cachedHash);
  }
  return cachedRoute;
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, current);
}

export function href(route: Route): string {
  return route.page === 'skill' ? `#/skill/${skillSlug(route.skillId)}` : `#/${route.page}`;
}

export function sameRoute(a: Route, b: Route): boolean {
  return href(a) === href(b);
}
