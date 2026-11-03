using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using Windows.Foundation;
using Windows.Media;
using Windows.Media.Control;
using Windows.Storage.Streams;

static class MediaHelper
{
    const int PollMs = 400;
    const int ResendMs = 5000;
    const int ArtTries = 6;

    static GlobalSystemMediaTransportControlsSessionManager manager;
    static readonly BlockingCollection<string> commands = new BlockingCollection<string>();
    static readonly TextWriter output = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true };

    static bool anyPlayer;
    static string lastJson = "";
    static string lastTrack = "";
    static int artTries;
    static DateTime lastSent = DateTime.MinValue;

    static int Main(string[] args) {

        int parent = args.Length > 0 ? int.Parse(args[0]) : 0;

        manager = Await(GlobalSystemMediaTransportControlsSessionManager.RequestAsync());

        if (manager == null) {

            Send("{\"type\":\"error\",\"message\":\"Media sessions are not available\"}");
            return 1;

        }

        var reader = new Thread(ReadCommands) { IsBackground = true };
        reader.Start();

        Send("{\"type\":\"ready\"}");

        int tick = 0;

        while (true) {

            string command;

            if (commands.TryTake(out command, PollMs))

            {
                if (command == null) return 0;

                Try(() => Run(command));
                continue;
            }

            if (parent != 0 && ++tick % 5 == 0 && !IsAlive(parent)) return 0;

            Try(Poll);
        }
    }

    static void ReadCommands() {

        var input = new StreamReader(Console.OpenStandardInput(), Encoding.UTF8);
        
        string line;

        while ((line = input.ReadLine()) != null) commands.Add(line);

        commands.Add(null);
    }

    static bool IsAlive(int pid) {

        try {

            return !Process.GetProcessById(pid).HasExited;
        
        } catch {

            return false;

        }
    }

    // Waits on a WinRT operation by hand. The AsTask() helper would need Windows.winmd from the SDK.
    static T Await<T>(IAsyncOperation<T> operation) {

        using (var done = new ManualResetEventSlim(operation.Status != AsyncStatus.Started)) {

            operation.Completed = (sender, status) => done.Set();

            if (!done.Wait(5000)) return default(T);
        }

        return operation.Status == AsyncStatus.Completed ? operation.GetResults() : default(T);
    }

    static void Try(Action action) {

        try {

            action();

        } catch (Exception err) {

            Send("{\"type\":\"error\",\"message\":" + Json(err.Message) + "}");

        }
    }

    static GlobalSystemMediaTransportControlsSession FindSession() {

        foreach (var session in manager.GetSessions()) {

            if (session.SourceAppUserModelId.IndexOf("spotify", StringComparison.OrdinalIgnoreCase) >= 0) return session;
        
        }

        return anyPlayer ? manager.GetCurrentSession() : null;
    }

    static void Run(string line) {

        var parts = line.Trim().Split(' ');

        switch (parts[0]) {

            case "any":
                anyPlayer = parts.Length > 1 && parts[1] == "1";
                lastJson = "";
                return;

            case "refresh":
                lastJson = "";
                lastTrack = "";
                return;
        }

        var session = FindSession();

        if (session == null) return;

        switch (parts[0]) {

            case "toggle": Await(session.TryTogglePlayPauseAsync()); break;
            case "play": Await(session.TryPlayAsync()); break;
            case "pause": Await(session.TryPauseAsync()); break;
            case "next": Await(session.TrySkipNextAsync()); break;
            case "prev": Await(session.TrySkipPreviousAsync()); break;
            case "seek": Await(session.TryChangePlaybackPositionAsync(long.Parse(parts[1]) * TimeSpan.TicksPerMillisecond)); break;
            case "shuffle": Await(session.TryChangeShuffleActiveAsync(parts[1] == "1")); break;
            case "repeat": Await(session.TryChangeAutoRepeatModeAsync((MediaPlaybackAutoRepeatMode)int.Parse(parts[1]))); break;
        }
    }

    static void Poll() {
        
        var session = FindSession();
        string json;
        
        GlobalSystemMediaTransportControlsSessionMediaProperties properties = null;
        
        string track = null;

        if (session == null) {

            json = "{\"type\":\"state\",\"active\":false}";
        
        } else {

            properties = Await(session.TryGetMediaPropertiesAsync());

            var playback = session.GetPlaybackInfo();
            var timeline = session.GetTimelineProperties();
            var app = session.SourceAppUserModelId;
            var title = properties != null ? properties.Title : "";
            var artist = properties != null ? properties.Artist : "";

            track = app + "|" + title + "|" + artist;

            json = "{\"type\":\"state\",\"active\":true"
                + ",\"app\":" + Json(app)
                + ",\"title\":" + Json(title)
                + ",\"artist\":" + Json(artist)
                + ",\"album\":" + Json(properties != null ? properties.AlbumTitle : "")
                + ",\"playing\":" + Bool(playback.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing)
                + ",\"shuffle\":" + Bool(playback.IsShuffleActive == true)
                + ",\"repeat\":" + (playback.AutoRepeatMode.HasValue ? (int)playback.AutoRepeatMode.Value : 0)
                + ",\"position\":" + (long)timeline.Position.TotalMilliseconds
                + ",\"duration\":" + (long)(timeline.EndTime - timeline.StartTime).TotalMilliseconds
                + ",\"updatedAt\":" + timeline.LastUpdatedTime.ToUnixTimeMilliseconds()
                + "}";
        }

        // Resend now and then so a page that reloaded catches up
        if (json != lastJson || (DateTime.UtcNow - lastSent).TotalMilliseconds >= ResendMs) {

            Send(json);
            lastJson = json;
            lastSent = DateTime.UtcNow;
        
        }

        if (track == null) return;

        if (track != lastTrack) {

            lastTrack = track;
            artTries = 0;

        }

        if (artTries < 0 || artTries >= ArtTries) return;

        artTries++;

        var art = ReadArt(properties);

        if (art == null) return;

        Send("{\"type\":\"art\",\"track\":" + Json(track) + ",\"data\":" + Json(art) + "}");
        artTries = -1;
    }

    static string ReadArt(GlobalSystemMediaTransportControlsSessionMediaProperties properties) {

        if (properties == null || properties.Thumbnail == null) return null;

        var stream = Await(properties.Thumbnail.OpenReadAsync());

        if (stream == null || stream.Size == 0) return null;

        using (stream)
        using (var reader = new DataReader(stream.GetInputStreamAt(0))) {

            var size = (uint)stream.Size;
            var bytes = new byte[size];

            if (Await(reader.LoadAsync(size)) < size) return null;

            reader.ReadBytes(bytes);

            var type = string.IsNullOrEmpty(stream.ContentType) ? "image/png" : stream.ContentType;

            return "data:" + type + ";base64," + Convert.ToBase64String(bytes);
        }
    }

    static void Send(string json) {

        lock (output) output.WriteLine(json);
    
    }

    static string Bool(bool value) {

        return value ? "true" : "false";
    
    }

    static string Json(string value) {

        if (value == null) return "\"\"";

        var builder = new StringBuilder(value.Length + 2);

        builder.Append('"');

        foreach (var c in value) {

            switch (c) {

                case '"': builder.Append("\\\""); break;
                case '\\': builder.Append("\\\\"); break;
                case '\n': builder.Append("\\n"); break;
                case '\r': builder.Append("\\r"); break;
                case '\t': builder.Append("\\t"); break;
                
                default:
                
                    if (c < 0x20) builder.Append("\\u").Append(((int)c).ToString("x4"));
                
                    else builder.Append(c);
                
                    break;
            }
        }

        return builder.Append('"').ToString();
    }
}