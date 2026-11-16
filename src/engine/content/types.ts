export interface ItemDef {
  readonly id: string;
  /** i18n key for the display name. */
  readonly nameKey: string;
  readonly sellPrice: number;
}

export interface ActionOutput {
  readonly itemId: string;
  readonly min: number;
  readonly max: number;
  /** Chance (0..1) that this output is produced at all. Defaults to 1. */
  readonly chance?: number;
}

/** A repeating timed action (Phase 0 demo; skills build on this in Phase 1). */
export interface ActionDef {
  readonly id: string;
  readonly nameKey: string;
  readonly durationMs: number;
  readonly outputs: readonly ActionOutput[];
}
