# serve.ps1 - a tiny static file server for Swing Theory Tracker.
# No installs needed: this uses .NET's built-in HttpListener, which ships
# with Windows PowerShell.
#
# Usage:
#   Right-click this file > "Run with PowerShell", or from a terminal:
#     powershell -ExecutionPolicy Bypass -File serve.ps1
#   Then open http://localhost:8080 in a browser on the same computer,
#   or http://<this-computer's-LAN-IP>:8080 from your phone (same wifi).
#
# Note: the app's "installable to home screen" / offline features need a
# secure context (https, or localhost). Plain http:// to another device's
# IP works fine for running workouts, but the phone won't be able to
# install it as an app that way - see README.md for real hosting options.

param(
  [int]$Port = 8080,
  [string]$Root = $PSScriptRoot
)

Add-Type -AssemblyName System.Net.HttpListener -ErrorAction SilentlyContinue

$mimeTypes = @{
  '.html'       = 'text/html; charset=utf-8'
  '.css'        = 'text/css; charset=utf-8'
  '.js'         = 'text/javascript; charset=utf-8'
  '.json'       = 'application/json; charset=utf-8'
  '.webmanifest'= 'application/manifest+json; charset=utf-8'
  '.svg'        = 'image/svg+xml'
  '.png'        = 'image/png'
  '.ico'        = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://+:$Port/"
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Host "Couldn't bind to $prefix - trying http://localhost:$Port/ instead (LAN access from your phone may not work)." -ForegroundColor Yellow
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://localhost:$Port/")
  $listener.Start()
}

Write-Host "Swing Theory Tracker is serving '$Root' on port $Port." -ForegroundColor Green
Write-Host "On this computer: http://localhost:$Port/" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $request = $context.Request
  $response = $context.Response

  try {
    $relativePath = [Uri]::UnescapeDataString($request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrEmpty($relativePath)) {
      $relativePath = 'index.html'
    }

    $filePath = Join-Path $Root $relativePath
    $fullRoot = (Resolve-Path $Root).Path
    $resolved = $null
    if (Test-Path $filePath) {
      $resolved = (Resolve-Path $filePath).Path
    }

    if ($resolved -and $resolved.StartsWith($fullRoot) -and -not (Get-Item $resolved).PSIsContainer) {
      $ext = [System.IO.Path]::GetExtension($resolved).ToLowerInvariant()
      $contentType = $mimeTypes[$ext]
      if (-not $contentType) { $contentType = 'application/octet-stream' }

      $bytes = [System.IO.File]::ReadAllBytes($resolved)
      $response.ContentType = $contentType
      $response.ContentLength64 = $bytes.Length
      $response.StatusCode = 200
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $relativePath")
      $response.StatusCode = 404
      $response.ContentType = 'text/plain'
      $response.ContentLength64 = $notFound.Length
      $response.OutputStream.Write($notFound, 0, $notFound.Length)
    }
  } catch {
    try {
      $response.StatusCode = 500
    } catch {}
  } finally {
    $response.OutputStream.Close()
  }
}
