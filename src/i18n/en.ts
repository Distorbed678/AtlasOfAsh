/**
 * English strings. All UI text goes through `t()` so other languages can be
 * added later by providing another dictionary with the same keys.
 */
export const en = {
  'app.title': 'Atlas of Ash',
  'app.version': 'v{version} ({sha})',

  'nav.home': 'Hearth',
  'nav.bank': 'Bank',
  'nav.settings': 'Settings',
  'nav.dev': 'Dev tools',
  'nav.group.general': 'General',
  'nav.group.upcoming': 'Coming soon',
  'nav.upcoming.skills': 'Skills',
  'nav.upcoming.combat': 'Combat',
  'nav.upcoming.character': 'Character',
  'nav.upcoming.passives': 'Passive tree',
  'nav.upcoming.town': 'Town',
  'nav.upcoming.atlas': 'Atlas',
  'nav.phase': 'Phase {n}',
  'nav.menu': 'Menu',

  'topbar.gold': 'Gold',

  'home.title': 'The Hearth',
  'home.intro':
    'Atlas of Ash is in early development. This build tests the foundation: the simulation engine, saving, and offline progress. Start an action, close the tab, and come back later.',
  'home.actions': 'Demo actions',
  'home.start': 'Start',
  'home.stop': 'Stop',
  'home.active': 'Active',
  'home.duration': 'Every {time}',
  'home.whatsNew': "What's new",

  'bank.title': 'Bank',
  'bank.empty': 'Your bank is empty.',
  'bank.sellAll': 'Sell all',
  'bank.value': 'Sells for {gold} gold each',

  'settings.title': 'Settings',
  'settings.save': 'Save data',
  'settings.saveNow': 'Save now',
  'settings.saved': 'Saved.',
  'settings.export': 'Export save',
  'settings.exportHelp': 'Copy this string somewhere safe. You can import it on any device.',
  'settings.copy': 'Copy',
  'settings.copied': 'Copied!',
  'settings.import': 'Import save',
  'settings.importHelp': 'Paste a save string. This replaces your current progress.',
  'settings.importButton': 'Import',
  'settings.importConfirm': 'Replace your current save with the imported one?',
  'settings.importDone': 'Save imported.',
  'settings.backups': 'Backups',
  'settings.backupsHelp': 'The game keeps your last {n} automatic backups (one every 10 minutes).',
  'settings.noBackups': 'No backups yet.',
  'settings.restore': 'Restore',
  'settings.restoreConfirm':
    'Restore the backup from {date}? Your current progress will be replaced.',
  'settings.debug': 'Debug bundle',
  'settings.debugHelp':
    'Downloads your save, RNG seeds and game version so a bug can be reproduced exactly.',
  'settings.debugButton': 'Download debug bundle',
  'settings.danger': 'Danger zone',
  'settings.reset': 'Delete save and start over',
  'settings.resetConfirm': 'Permanently delete your save and all backups?',
  'settings.flags': 'Feature flags',

  'away.title': 'While you were away',
  'away.duration': 'You were gone for {time}.',
  'away.actions': 'Actions completed: {n}',
  'away.gold': 'Gold: {gold}',
  'away.nothing': 'Nothing happened. Start an action before you leave!',
  'away.close': 'Continue',
  'catchup.title': 'Catching up…',
  'catchup.progress': 'Simulating {done} of {total}',

  'whatsNew.title': "What's new",
  'whatsNew.close': 'Close',

  'crash.title': 'Something broke',
  'crash.body':
    'The game hit an unexpected error. Your progress was saved. Copy the export string below as an extra backup, then reload.',
  'crash.reload': 'Reload',
  'crash.debug': 'Download debug bundle',

  'dev.title': 'Dev tools',
  'dev.skip': 'Skip time',
  'dev.speed': 'Simulation speed',
  'dev.give': 'Give item',
  'dev.giveButton': 'Give',
  'dev.gold': 'Add 1,000 gold',
  'dev.state': 'Raw state',

  'item.demo_ember': 'Ember',
  'item.demo_ash': 'Pale Ash',
  'item.demo_cinder_shard': 'Cinder Shard',
  'action.demo_kindle': 'Kindle Embers',
  'action.demo_sift': 'Sift the Ash',

  'error.generic': 'Error: {message}',
} as const;

export type TKey = keyof typeof en;
