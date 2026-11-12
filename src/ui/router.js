// Screen router (ARCHITECTURE §4). Each screen: render(root, ctx).
import * as title from './screens/title.js';
import * as newgame from './screens/newgame.js';
import * as dawn from './screens/dawn.js';
import * as counter from './screens/counter.js';
import * as night from './screens/night.js';
import * as summary from './screens/summary.js';
import * as ledger from './screens/ledger.js';
import * as settings from './screens/settings.js';
import * as ending from './screens/ending.js';
import * as sheets from './screens/sheets.js';

export const SCREENS = { title, newgame, dawn, counter, night, summary, ledger, settings, ending };

export const SHEETS = {
  ledger: { title: 'Ledger', screen: 'ledger', render: ledger.render },
  stock: { title: 'Stock', screen: 'stock', render: sheets.renderStock },
  slots: { title: 'Load game', screen: 'slots', render: sheets.renderSlots },
  help: { title: 'How it works', screen: 'help', render: sheets.renderHelp },
};
