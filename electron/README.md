# Better Fenrid Desktop

Fenrid in its own window with Better Fenrid built in, so no userscript manager is needed

## What it adds

- **Spotify Controls**: a player above your profile in the bottom left with the cover, the track, play/pause, skip, shuffle, repeat and a seek bar. It talks to the Spotify app through Windows' media controls via a 12 KB helper (`src/media/MediaHelper.cs`, built with the C# compiler that ships with Windows), so you don't log in to anything. The *Other players too* setting also lets it control other media apps.
- **Screen sharing** with a picker for screens and windows, plus system audio.
- **Tray icon**: closing the window sends the app to the tray. The tray menu can turn that off, set the app to start with Windows, reload Fenrid, or open the data folder.
- **Desktop basics**: the window remembers its size and position, links to other sites open in your browser, the taskbar flashes when the title shows unread messages, and there's spell check with suggestions.

Shortcuts: `Ctrl+R` / `F5` reload, `Ctrl+Shift+R` reload without cache, `Ctrl+Shift+I` / `F12` DevTools, `Ctrl` `+` / `-` / `0` zoom, `Alt+←` / `Alt+→` back and forward, `F11` full screen.

Spotify Controls only works on Windows for now