# Better Fenrid Desktop

Fenrid in its own window with Better Fenrid built in, so no userscript manager is needed

## What it adds

- **Spotify Controls**: a player above your profile in the bottom left with the cover, the track, play/pause, skip, shuffle, repeat and a seek bar. It talks to the Spotify app through Windows' media controls via a 12 KB helper (`src/media/MediaHelper.cs`, built with the C# compiler that ships with Windows), so you don't log in to anything. The *Other players too* setting also lets it control other media apps.
- **Screen sharing** with a picker for screens and windows, plus system audio.
- **Tray icon**: closing the window sends the app to the tray. The tray menu can turn that off, set the app to start with Windows, reload Fenrid, or open the data folder.
- **Desktop basics**: the window remembers its size and position, links to other sites open in your browser, the taskbar flashes when the title shows unread messages, and there's spell check with suggestions.

Shortcuts: `Ctrl+R` / `F5` reload, `Ctrl+Shift+R` reload without cache, `Ctrl+Shift+I` / `F12` DevTools, `Ctrl` `+` / `-` / `0` zoom, `Alt+←` / `Alt+→` back and forward, `F11` full screen.

## Running it

```sh
cd electron
npm install
npm start        # builds the mod in the repo root, then opens the app
```

`npm run dev` opens the app without rebuilding. While it's running, `npm run watch` in the repo root rebuilds the mod and the app reloads by itself.

## Building an installer

```sh
npm run dist            # out/Better Fenrid Setup x.y.z.exe (~92 MB)
npm run dist:portable   # out/Better Fenrid x.y.z.exe, a single file, no install
```

To keep it small, the build only ships English and Polish for Chromium's own UI, drops the DirectX shader compiler (only WebGPU uses it), and compresses at the maximum level.

## Where the mod comes from

The app uses the first of these that exists:

1. The path in the `BF_MOD_PATH` environment variable
2. `betterfenrid.js` in the data folder (`%APPDATA%\Better Fenrid`). Drop a newer build here to update the mod without reinstalling.
3. The copy bundled with the installer
4. `../dist/betterfenrid.js` when running from source

Spotify Controls only works on Windows for now.