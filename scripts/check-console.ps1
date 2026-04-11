$ErrorActionPreference = 'SilentlyContinue'
try {
    $pages = Invoke-RestMethod -Uri 'http://localhost:9222/json' -TimeoutSec 3
    $appPage = $pages | Where-Object { $_.type -eq 'page' -and $_.url -notlike "devtools://*" }
    if (-not $appPage) { Write-Host "No app page"; exit 1 }

    $wsUrl = $appPage.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [Threading.CancellationToken]::None
    $ws.ConnectAsync($wsUrl, $ct).Wait()

    # Enable console event
    $enable = @{"id"=1;"method"="Log.enable"} | ConvertTo-Json -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($enable)
    $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, $ct).Wait()

    # Wait for console events
    $buf = [byte[]]::new(8192)
    $end = (Get-Date).AddSeconds(5)
    $events = @()
    while ($ws.State -eq 'Open' -and (Get-Date) -lt $end) {
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, $ct)
        if ($r.Wait(1000) -and $r.Result.Count -gt 0) {
            $data = [Text.Encoding]::UTF8.GetString($buf,0,$r.Result.Count)
            if ($data -match "console" -or $data -match "exception" -or $data -match "error" -or $data -match "Error") {
                $events += $data
            }
        }
    }
    Write-Host "Console events: $($events.Count)"
    $events | ForEach-Object { Write-Host $_ }
    $ws.CloseAsync('NormalClosure', "", $ct).Wait()
} catch {
    Write-Host "Error: $_"
}
