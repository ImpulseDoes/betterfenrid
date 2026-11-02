# Better Fenrid

A client mod for [Fenrid](https://fenrid.com). It adds plugins, custom themes and its own settings section to the official web app, without replacing it, our fenrid server -> https://fenrid.com/FzyW30IO

[![Install with Tampermonkey](https://img.shields.io/badge/Install-Tampermonkey-00485B?style=for-the-badge&logo=tampermonkey&logoColor=white)](https://github.com/ImpulseDoes/betterfenrid/releases/latest/download/betterfenrid.user.js)
[![Install with Violentmonkey](https://img.shields.io/badge/Install-Violentmonkey-F7DF1E?style=for-the-badge&labelColor=333333)](https://github.com/ImpulseDoes/betterfenrid/releases/latest/download/betterfenrid.user.js)

> Better Fenrid is a community project and isn't made by the Fenrid team. Use at your own risk.

## Features

- **Settings section**: a *Better Fenrid* section in Fenrid's settings sidebar, with Settings, Plugins and Themes pages.
- **Plugins**: turn them on and off instantly, with no reload. Each plugin can have its own settings.
- **Themes**: comes with Onyx, a near-black theme like Discord's, on by default, and Impulse's Default, an anime background behind glass panels. You can switch back to Fenrid's own look and add custom CSS on top, applied live.
- **Context menu items**: plugins can add their own items to the message, channel and user right-click menus.
- **Backup**: export, import and reset your settings.

### Built-in plugins

| Plugin | What it does |
| --- | --- |
| Better Fenrid Badges | Shows a badge next to Better Fenrid developers and contributors. The list lives in `src/badges.ts`. |
| Clear URLs | Removes tracking parameters (`utm_*`, `fbclid`, `si=`…) from links you send or paste. |
| Community Statistics | Adds *Community Statistics* to the server menu: members, online count, channels, roles, emojis and owner in a modal. |
| Deleted Messages | Keeps deleted messages in the chat, marked in red, your own included, and saves them to a history you can open from the plugin's settings. Stored only in your browser. |
| Double Click To Edit | Double click one of your messages in a server channel to edit it. |
| Edit History | Shows earlier versions of edited messages above them, and adds *Edit History* to the message menu. Only edits seen while Fenrid is open are saved, in your browser. |
| Force Owner Crown | Shows a crown next to the server owner in messages, and in the member list when the server hides it. |
| Mention Avatars | Shows user avatars inside mentions. |
| No Reply Mentions | Turns off the reply ping by default. You can still turn it on for a single reply. Off by default. |
| Permission Viewer | Adds *Permissions* to the user, server, channel and category menus: a member's permissions and which roles give them, every role's permissions, and what a channel allows or denies. |
| Quote Message | Adds *Quote Message* to the message menu: pastes the message into your message box as a quote. |
| Show Hidden Things | Shows a clock next to members who are timed out, which Fenrid has the data for but doesn't display. |
| Silent Typing | Hides that you are typing. Off by default. |
| Translate | Adds *Translate* to the message menu: opens the message in Google Translate. |
| Typing in Channel List | Shows animated dots next to channels where someone is typing. |
| View Raw | Adds *View Raw* to the message, channel, category and user menus: shows the raw JSON, with a copy button. |
| Who Reacted | Shows the avatars of the people who reacted to a message. |

After an update, Better Fenrid lists what changed the first time Fenrid loads. You can turn this off in *Better Fenrid → Settings*.

## Install

Better Fenrid runs as a userscript in your browser.

1. Install a userscript manager: [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/).
2. [Open the latest build](https://github.com/ImpulseDoes/betterfenrid/releases/latest/download/betterfenrid.user.js). Your userscript manager will offer to install it.
3. Open [fenrid.com](https://fenrid.com) and go to **Settings**. You'll find the **Better Fenrid** section above *General*.

Your userscript manager keeps it up to date on its own.

## Development

Requires Node.js 20 or newer.

```sh
npm install
npm run build      # builds dist/betterfenrid.user.js and dist/betterfenrid.js
npm run watch      # rebuilds on every change
npm run typecheck
npm run themes     # regenerates Onyx's overrides for colors Fenrid hardcodes
```

To try changes, install `dist/betterfenrid.user.js` in your userscript manager. Violentmonkey can track the local file and reload it on changes.

### Project layout

```
src/
├─ index.ts              entry point
├─ meta.ts               name, version, repo URL
├─ core/
│  ├─ selectors.ts       every assumption about Fenrid's UI (start here when something breaks)
│  ├─ plugins.ts         plugin API and manager
│  ├─ settings.ts        settings store (localStorage)
│  ├─ entities.ts        raw messages, channels and users seen on the network
│  ├─ dom.ts             DOM helpers and the shared MutationObserver
│  ├─ react.ts           reads props from Fenrid's React components
│  ├─ styles.ts          stylesheet helper
│  ├─ theme.ts           theme presets and custom CSS
│  └─ logger.ts
├─ api/                  helpers for plugins: context menus, network hooks, modals, toasts, message box
├─ ui/
│  ├─ settingsSidebar.ts adds the Better Fenrid section to the settings sidebar
│  ├─ panel.ts           draws our pages over Fenrid's settings content area
│  ├─ pages/             Settings, Plugins and Themes pages
│  ├─ components.ts      switches, buttons, inputs
│  ├─ icons.ts
│  └─ styles.css
├─ plugins/              built-in plugins (registered in plugins/index.ts)
└─ themes/               theme presets (registered in core/theme.ts)
```

### How it works

Fenrid is a Next.js (React) app with hashed class names that change between releases. Better Fenrid doesn't rely on those. Instead it:

- finds elements by their visible labels (e.g. *Privacy & Safety*, *Copy Message ID*), all listed in `src/core/selectors.ts`;
- copies Fenrid's own elements for its sidebar and menu items, so they match the native look;
- draws its settings pages in a panel laid over the settings content, without touching Fenrid's React tree;
- themes Fenrid by overriding the CSS variables its design is built on;
- watches the gateway WebSocket and `/api` responses from `document-start`, which is how plugins get raw data the DOM doesn't have.

If Fenrid renames or moves something, `src/core/selectors.ts` is usually the only file that needs updating.

### Writing a plugin

Create a file in `src/plugins/` and add it to `src/plugins/index.ts`:

```ts
import { toast } from '../api/toast'
import { definePlugin } from '../core/plugins'

export default definePlugin({
  id: 'helloWorld', // storage key, never change it after release
  name: 'Hello World',
  description: 'Says hello from the message menu.',
  authors: ['you'],
  settings: {
    greeting: { type: 'string', label: 'Greeting', default: 'Hello' },
  },

  start(ctx) {
    ctx.addContextMenuItem({
      id: 'hello',
      label: 'Say Hello',
      icon: '👋',
      action: (target) => toast(`${ctx.settings.greeting}! Message ID: ${target.id}`),
    })
  },
})
```

Anything registered through `ctx` (menu items, styles, DOM listeners) is cleaned up automatically when the plugin is turned off. For anything else, return a cleanup function from `start` or use `ctx.onStop`.

Menu items go to the message menu unless you pass `kinds: ['message', 'channel', 'user']`.

Setting types: `boolean`, `string` (optionally `multiline`), `number` (`min`/`max`/`step`) and `select` (`options`). The Plugins page builds the settings UI from them automatically.

## Releasing

Every push to `main` builds the userscript and publishes it as a new release, numbered `<version in package.json>.<build number>`. Changes that only touch Markdown files don't trigger a release.

Bump `version` in `package.json` for bigger milestones.

## License

[MIT](LICENSE)