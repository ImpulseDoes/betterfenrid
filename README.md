# Better Fenrid

A client mod for [Fenrid](https://fenrid.com). It adds plugins, custom themes and its own settings section to the official web app, without replacing it, our fenrid server -> https://fenrid.com/FzyW30IO

[![Install with Tampermonkey](https://img.shields.io/badge/Install-Tampermonkey-00485B?style=for-the-badge&logo=tampermonkey&logoColor=white)](https://github.com/ImpulseDoes/betterfenrid/releases/latest/download/betterfenrid.user.js)
[![Install with Violentmonkey](https://img.shields.io/badge/Install-Violentmonkey-F7DF1E?style=for-the-badge&labelColor=333333)](https://github.com/ImpulseDoes/betterfenrid/releases/latest/download/betterfenrid.user.js)

> Better Fenrid is a community project and isn't made by the Fenrid team. Use at your own risk.

## Features

- **Settings section**: a *Better Fenrid* section in Fenrid's settings sidebar, with Settings, Plugins and Themes pages.
- **Plugins**: turn them on and off instantly, with no reload. Each plugin can have its own settings.
- **Themes**: comes with built-in presets ported from popular BetterDiscord themes (Catppuccin Mocha, Dracula, Nord, Tokyo Night, Dark Matter, Frosted Glass, Translucence, Rosé Pine, Synthwave '84, Onyx, Impulse's Default, Not Another Anime, Sakura, Shaula, Mrs Wicket, LilyPichu, SoftX, and Amethyst). You can switch back to Fenrid's own look and add custom CSS on top, applied live. Wallpaper themes load images from `media.idoes.pl`, and fall back to this GitHub repo via jsDelivr so they are not inlined in the userscript.
- **Custom font**: use a font installed on your computer, or any font from Google Fonts. A Google font is downloaded once and its rules are kept in your browser, so Google isn't asked again each time Fenrid opens.
- **Sounds**: typing and sending sounds (built-in ones, or your own file), and your own files in place of any of Fenrid's sounds: new message, calls, joins and leaves, mute and deafen. Your files stay in your browser.
- **Context menu items**: plugins can add their own items to the message, channel and user right-click menus.
- **Backup**: export, import and reset your settings.

### Built-in plugins

| Plugin | What it does |
| --- | --- |
| Android Support | Only in the Android app, and always on there. Puts the Better Fenrid pages in Fenrid's phone settings list, lets the back button close them, and turns off effects that make phones run hot (blur, fixed wallpaper). |
| Anonymise File Names | Gives files you upload a new name (random, date and time, or a fixed name) and keeps the extension, so the original name never reaches Fenrid. Works for files you pick, paste or drag in. Off by default. |
| Badge Faker | Shows the Fenrid badges you pick on your own profile. Only you can see them: nothing is sent to Fenrid. Off by default. |
| Better Fenrid | Polishes Fenrid: animated icons, Discord-style animations (menus, tooltips, popouts, dialogs and settings open and close, channels and servers slide in from the side you moved to, new messages ease in; each with its own style or off, inspired by BetterDiscord's BetterAnimations), smoother motion and tidier details. Can also turn off background blur for older computers. |
| Better Fenrid Badges | Shows a badge next to Better Fenrid developers and contributors. The list lives in `src/badges.ts`. |
| Better Embed Formats | Turns Spotify, YouTube and GitHub links into Discord-style cards. |
| Better Folders | Shows the servers of open folders in their own sidebar next to the server list, like Vencord's plugin. Closed folders get a folder icon instead of small server icons, and folder settings offer six colors in place of Fenrid's picker. Options can close or open folders as you move between servers. |
| Camera Quality | Picks the resolution, frame rate and bitrate of your camera in calls, up to 1440p at 60 FPS. Works from the next time you turn your camera on. Off by default. |
| Clear URLs | Removes tracking parameters (`utm_*`, `fbclid`, `si=`…) from links you send or paste. |
| Community Statistics | Adds *Community Statistics* to the server menu: members, online count, channels, roles, emojis and owner in a modal. |
| Deleted Messages | Keeps deleted messages in the chat, marked in red, your own included, and saves them to a history you can open from the plugin's settings. Stored only in your browser. *Remove From History* in the message menu drops a message for good. |
| Double Click To Edit | Double click one of your messages in a server channel to edit it. |
| Edit History | Shows earlier versions of edited messages above them, and adds *Edit History* to the message menu. Only edits seen while Fenrid is open are saved, in your browser. *Remove From History* clears them for that message. |
| Experiments | Adds an Experiments tab to the sidebar with hidden Fenrid features (default profile themes, What's New on demand), its debug logs, what's in development, and a data inspector that records which fields Fenrid sends (names and types only). Fenrid has no feature flags, so this doesn't unlock unreleased features. Off by default. |
| Expression Manager | Right click an emoji, a reaction or a GIF to clone it to a server where you can add emojis. Files must be on Fenrid's own storage and at most 256 KiB, except still images, which are shrunk. |
| Fake Surge | Lets you pick emojis marked *Requires Surge*: they are sent as image links and shown as emojis for you, like Vencord's FakeNitro. Emojis a server blocks stay blocked. Also unlocks 1080p, 1440p and 60 FPS screen sharing with a matching bitrate. Off by default. |
| Force Owner Crown | Shows a crown next to the server owner in messages, and in the member list when the server hides it. |
| Hide Blocked Users | Hides messages from people you blocked: Fenrid shows them in chat as usual. Off by default. |
| Image Link | Never hides image links in messages, even when the image is all the message has. The link appears above the image. GIFs are optional. Off by default. |
| Image Zoom | A magnifying lens for pictures you open full size, like Vencord's ImageZoom. Hold the mouse button on the picture; scroll to zoom, Shift + scroll to resize the lens. Can also show on hover, as a square, or with sharp pixels. |
| Loading Messages | Replaces the messages on Fenrid's loading screen with your own, and the signature under them. Mix them with Fenrid's if you like. Off by default. |
| Mention Avatars | Shows user avatars inside mentions. |
| Message Colors | Writes your messages in a color you pick: 9 presets or any #RRGGBB. Other Better Fenrid users see it too, through a few invisible characters added to your messages. Everyone else sees normal text. Messages that are only emojis stay without the marker, so the emojis stay big. Off by default. |
| Microphone Quality | Picks the bitrate of your microphone in calls, up to 510 kbps. Works from the next time you join a call. Off by default. |
| No Link Warning | Opens links straight away, without the *Leaving Fenrid* warning. Works for every link, or only the sites you list. Off by default. |
| No Reply Mentions | Turns off the reply ping by default. You can still turn it on for a single reply. Off by default. |
| Oneko | A pixel cat that chases your cursor, ported from [oneko.js](https://github.com/adryd325/oneko.js) by adryd (MIT). Off by default. |
| Permission Viewer | Adds *Permissions* to the user, server, channel and category menus: a member's permissions and which roles give them, every role's permissions, and what a channel allows or denies. |
| Pin DMs | Right click a DM and pick *Pin DM* to keep it at the top of the list, under a *Pinned* heading. Off by default. |
| Read All Button | Adds a *Read All* button above the server list that marks every server as read. Direct messages stay unread. |
| Platform Indicators | Shows whether someone is on a computer or a phone next to their name, and how many sessions they have open. Green is active, yellow is idle. People who appear invisible show nothing. Off by default. |
| Profile Themes | Two-color profile themes and animated banners without Flare. Set them in the plugin, then save your profile: the theme is hidden in your bio as invisible characters, so everyone with the plugin sees it, like Vencord's FakeProfileThemes. Off by default. |
| Quote Message | Adds *Quote Message* to the message menu: pastes the message into your message box as a quote. |
| Relationship Notifier | Tells you when someone removes you from their friends, takes back a friend request, or when you are kicked or banned from a server (or it is deleted). Also catches changes from while Fenrid was closed. Off by default. |
| Resizable Channel List | Drag the edge of the channel list to make it wider or narrower, like on Discord. Double click the edge to reset it. |
| Shaders | Weather in front of your wallpaper, drawn by your graphics card behind Fenrid (the panels turn see-through like with Wallpaper Manager). Four effects: **Rain on glass** (drops merge, slide down and show your wallpaper upside down inside them, based on Lucas Bebber's [Rain & Water Effect Experiments](https://tympanus.net/codrops/2015/11/04/rain-water-effect-experiments/), with optional lightning), **Rain on a pond** (your wallpaper under water, with ripples from the rain and from your cursor), **Snowfall** (flakes at different distances, the near ones out of focus) and **Frozen window** (fern frost creeping in from the edges). Without a wallpaper you look at city lights out of focus. You set how much and how fast, plus the frame rate and quality to go easy on your graphics card. Off by default. |
| Show Hidden Things | Shows a clock next to members who are timed out, which Fenrid has the data for but doesn't display. |
| Silent Typing | Hides that you are typing. Off by default. |
| Translate | Adds *Translate* to the message menu: opens the message in Google Translate. |
| Typing in Channel List | Shows animated dots next to channels where someone is typing. |
| View Icons | Click an avatar or banner on a profile to see it full size, like Vencord's ViewIcons, with a link to the original. The user menu also gets *View Avatar* and *View Banner*. |
| View Raw | Adds *View Raw* to the message, channel, category and user menus: shows the raw JSON, with a copy button. |
| Voice Timers | Shows how long a call has been going on, as a pill next to the voice channel's name. It counts from the person who has been there longest, with a "≥" (at least) when they were already there as you opened Fenrid. Can also show each person's time. |
| Wallpaper Manager | Adds a *Wallpapers* tab: pick a wallpaper from the Better Fenrid collection or paste your own link. Your theme's colors stay; on solid themes you choose how much they dim the wallpaper. Off by default. |
| Who Reacted | Shows the avatars of the people who reacted to a message. |

After an update, Better Fenrid lists what changed the first time Fenrid loads. You can turn this off in *Better Fenrid → Settings*.

## Install

Better Fenrid runs as a userscript in your browser.

1. Install a userscript manager: [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/).
2. [Open the latest build](https://github.com/ImpulseDoes/betterfenrid/releases/latest/download/betterfenrid.user.js). Your userscript manager will offer to install it.
3. Open [fenrid.com](https://fenrid.com) and go to **Settings**. You'll find the **Better Fenrid** section above *General*.

Your userscript manager keeps it up to date on its own.

### Android

Download `Better-Fenrid.apk` from the [Android release](https://github.com/ImpulseDoes/betterfenrid/releases/tag/android) and open it on your phone. Android asks you to allow installing apps from your browser the first time. The mod inside updates itself. See [android/README.md](android/README.md) for what works and what doesn't

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
   └─ assets/            wallpapers (served from the CDN / GitHub, not bundled)
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