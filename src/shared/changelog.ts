/**
 * Parses CHANGELOG.md (Keep a Changelog style) for the in-game "What's new" panel:
 *
 *   ## [0.0.1] - 2026-11-16
 *   ### Added
 *   - Something
 */
export interface ChangelogSection {
  title: string;
  items: string[];
}
export interface ChangelogRelease {
  version: string;
  date?: string;
  sections: ChangelogSection[];
}

export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let release: ChangelogRelease | undefined;
  let section: ChangelogSection | undefined;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    const rel = /^##\s+\[?([^\]\s]+)\]?(?:\s*-\s*(\S+))?/.exec(line);
    if (rel && !line.startsWith('###')) {
      release = { version: rel[1]!, date: rel[2], sections: [] };
      releases.push(release);
      section = undefined;
      continue;
    }
    const sec = /^###\s+(.+)$/.exec(line);
    if (sec && release) {
      section = { title: sec[1]!, items: [] };
      release.sections.push(section);
      continue;
    }
    const item = /^[-*]\s+(.+)$/.exec(line);
    if (item && release) {
      if (!section) {
        section = { title: 'Changes', items: [] };
        release.sections.push(section);
      }
      section.items.push(item[1]!);
    }
  }
  return releases;
}
