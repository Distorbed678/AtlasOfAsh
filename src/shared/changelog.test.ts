import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseChangelog } from './changelog';

describe('parseChangelog', () => {
  it('parses releases, sections and items', () => {
    const md = `# Changelog

## [Unreleased]
- Loose item

## [0.0.2] - 2026-12-01
### Added
- Mining
- Workers
### Fixed
- A bug
`;
    const r = parseChangelog(md);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ version: 'Unreleased', date: undefined, sections: [{ title: 'Changes', items: ['Loose item'] }] });
    expect(r[1]!.date).toBe('2026-12-01');
    expect(r[1]!.sections.map((s) => s.title)).toEqual(['Added', 'Fixed']);
    expect(r[1]!.sections[0]!.items).toEqual(['Mining', 'Workers']);
  });

  it('the real CHANGELOG.md parses into at least one release', () => {
    const md = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8');
    expect(parseChangelog(md).length).toBeGreaterThan(0);
  });
});
