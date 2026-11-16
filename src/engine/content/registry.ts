import { RETIRED_IDS } from './retiredIds';

/**
 * Stable content IDs.
 *
 * Every piece of content (item, affix, node, gem, monster, action...) has a
 * permanent string id of the form `category.name` (e.g. `item.ember`).
 * Rules:
 *  - ids are never changed once shipped (rename the display text instead);
 *  - removed content's id goes into RETIRED_IDS and is never reused;
 *  - saves only ever reference content by id.
 */
export interface HasId {
  readonly id: string;
}

const ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z0-9_]+)+$/;

export class ContentRegistry<T extends HasId> {
  private readonly byId = new Map<string, T>();

  constructor(
    readonly category: string,
    entries: readonly T[] = [],
  ) {
    for (const e of entries) this.add(e);
  }

  add(entry: T): void {
    const { id } = entry;
    if (!ID_PATTERN.test(id))
      throw new Error(`Invalid content id "${id}" (expected category.name)`);
    if (!id.startsWith(`${this.category}.`))
      throw new Error(`Content id "${id}" must start with "${this.category}."`);
    if (this.byId.has(id)) throw new Error(`Duplicate content id "${id}"`);
    if (RETIRED_IDS.has(id))
      throw new Error(`Content id "${id}" is retired and must not be reused`);
    this.byId.set(id, entry);
  }

  get(id: string): T {
    const e = this.byId.get(id);
    if (!e) throw new Error(`Unknown ${this.category} id "${id}"`);
    return e;
  }

  tryGet(id: string): T | undefined {
    return this.byId.get(id);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  all(): T[] {
    return [...this.byId.values()];
  }
}
