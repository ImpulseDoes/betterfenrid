# Better Fenrid

A client mod for [Fenrid](https://fenrid.com). It adds plugins, custom themes and its own settings section to the official web app, without replacing it, our fenrid server -> https://fenrid.com/FzyW30IO

> Better Fenrid is a community project and isn't made by the Fenrid team. Use at your own risk.

## Features

- **Settings section**: a *Better Fenrid* section in Fenrid's settings sidebar, with Settings, Plugins and Themes pages.
- **Plugins**: turn them on and off instantly, with no reload. Each plugin can have its own settings.
- **Themes**: comes with Onyx, a near-black theme like Discord's, on by default. You can switch back to Fenrid's own look and add custom CSS on top, applied live.
- **Context menu items**: plugins can add their own items to the message, channel and user right-click menus.
- **Backup**: export, import and reset your settings.

### Built-in plugins

| Plugin | What it does |
| --- | --- |
| Deleted Messages | Keeps deleted messages in the chat, marked in red, your own included, and saves them to a history you can open from the plugin's settings. Stored only in your browser. |
| Quote Message | Adds *Quote Message* to the message menu: pastes the message into your message box as a quote. |
| View Raw | Adds *View Raw* to the message, channel and user menus: shows the raw JSON, with a copy button. |
| Translate | Adds *Translate* to the message menu: opens the message in Google Translate. |

## Install

Better Fenrid runs as a userscript in your browser.

1. Install a userscript manager: [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/).
2. Download `betterfenrid.user.js` from the [latest release](https://github.com/ImpulseDoes/betterfenrid/releases/latest) and open it. Your userscript manager will offer to install it.
3. Open [fenrid.com](https://fenrid.com) and go to **Settings**. You'll find the **Better Fenrid** section above *General*.

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

Bump `version` in `package.json`, then push a tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions builds the userscript and attaches it to a new release.

## License

[MIT](LICENSE)