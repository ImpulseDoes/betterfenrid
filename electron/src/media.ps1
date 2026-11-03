$ErrorActionPreference = 'Stop'

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($operation, [Type]$type) {

  $task = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($operation))

  $null = $task.Wait(5000)

  if (-not $task.IsCompleted) { return $null }

  $task.Result
}

$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]

$manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$pending = $stdin.ReadLineAsync()
$anyPlayer = $false
$lastJson = ''
$lastTrack = ''
$artTries = 0
$lastSent = [DateTime]::MinValue

function Send($object) {

  [Console]::Out.WriteLine(($object | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()

}

function Find-Session {

  $sessions = $manager.GetSessions()
  $spotify = $sessions | Where-Object { $_.SourceAppUserModelId -match 'spotify' } | Select-Object -First 1

  if ($spotify) { return $spotify }
  if ($anyPlayer) { return $manager.GetCurrentSession() }

  $null
}

function Read-Art($properties) {

  if (-not $properties.Thumbnail) { return $null }
  
  $stream = Await ($properties.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
  
  if (-not $stream) { return $null }
  
  $size = [uint32][Windows.Storage.Streams.IRandomAccessStream].GetProperty('Size').GetValue($stream)
  
  if ($size -eq 0) { return $null }
  
  $type = [Windows.Storage.Streams.IContentTypeProvider].GetProperty('ContentType').GetValue($stream)
  
  if (-not $type) { $type = 'image/png' }
  
  $inStream = [Windows.Storage.Streams.IRandomAccessStream].GetMethod('GetInputStreamAt').Invoke($stream, @([uint64]0))
  $reader = [Windows.Storage.Streams.DataReader]::new($inStream)
  
  $null = Await ($reader.LoadAsync($size)) ([uint32])
  
  $bytes = New-Object byte[] $size
  $reader.ReadBytes($bytes)
  
  "data:$type;base64," + [Convert]::ToBase64String($bytes)
}

function Run-Command($session, [string]$line) {

  $parts = $line.Trim().Split(' ')

  switch ($parts[0]) {

    'any' { $script:anyPlayer = $parts[1] -eq '1'; $script:lastJson = ''; return }
    'refresh' { $script:lastJson = ''; $script:lastTrack = ''; return }

  }

  if (-not $session) { return }

  $op = switch ($parts[0]) {
    'toggle' { $session.TryTogglePlayPauseAsync() }
    'play' { $session.TryPlayAsync() }
    'pause' { $session.TryPauseAsync() }
    'next' { $session.TrySkipNextAsync() }
    'prev' { $session.TrySkipPreviousAsync() }
    'seek' { $session.TryChangePlaybackPositionAsync([long]$parts[1] * 10000) }
    'shuffle' { $session.TryChangeShuffleActiveAsync($parts[1] -eq '1') }
    'repeat' { $session.TryChangeAutoRepeatModeAsync([Windows.Media.MediaPlaybackAutoRepeatMode][int]$parts[1]) }
  }
  if ($op) { $null = Await $op ([bool]) }
}

Send @{ type = 'ready' }

while ($true) {

  $session = $null
  
  try { $session = Find-Session } catch { }

  if ($pending.IsCompleted) {
  
    $line = $pending.Result
  
    if ($null -eq $line) { exit 0 }
  
    try { Run-Command $session $line } catch { Send @{ type = 'error'; message = "$_" } }
  
    $pending = $stdin.ReadLineAsync()
  
    continue
  }

  try {
  
    if (-not $session) {
  
      $state = @{ type = 'state'; active = $false }
  
    } else {
  
      $properties = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $playback = $session.GetPlaybackInfo()
      $timeline = $session.GetTimelineProperties()
      $duration = ($timeline.EndTime - $timeline.StartTime).TotalMilliseconds
      $state = @{
        type      = 'state'
        active    = $true
        app       = $session.SourceAppUserModelId
        title     = $properties.Title
        artist    = $properties.Artist
        album     = $properties.AlbumTitle
        playing   = [int]$playback.PlaybackStatus -eq 4
        shuffle   = [bool]$playback.IsShuffleActive
        repeat    = if ($null -ne $playback.AutoRepeatMode) { [int]$playback.AutoRepeatMode } else { 0 }
        position  = [long]$timeline.Position.TotalMilliseconds
        duration  = [long]$duration
        updatedAt = $timeline.LastUpdatedTime.ToUnixTimeMilliseconds()
      }
    }

    $json = $state | ConvertTo-Json -Compress

    if ($json -ne $lastJson -or ([DateTime]::UtcNow - $lastSent).TotalSeconds -ge 5) {
    
      [Console]::Out.WriteLine($json)
      [Console]::Out.Flush()
    
      $lastJson = $json
      $lastSent = [DateTime]::UtcNow
    
    }

    if ($state.active) {
    
      $track = "$($state.app)|$($state.title)|$($state.artist)"
    
      if ($track -ne $lastTrack) { $lastTrack = $track; $artTries = 0 }
      if ($artTries -ge 0 -and $artTries -lt 6) {
    
        $artTries++
        $art = Read-Art $properties
    
        if ($art) { Send @{ type = 'art'; track = $track; data = $art }; $artTries = -1 }
      }
    }
  
  } catch {
  
    Send @{ type = 'error'; message = "$_" }
  
  }

  Start-Sleep -Milliseconds 400
}