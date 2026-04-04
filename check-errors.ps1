$ErrorActionPreference = 'SilentlyContinue'
try {
    $pages = Invoke-RestMethod -Uri 'http://localhost:9222/json' -TimeoutSec 3
    $appPage = $pages | Where-Object { $_.type -eq 'page' -and $_.url -notlike "devtools://*" }
    if (-not $appPage) { Write-Host "No app page"; exit 1 }

    $wsUrl = $appPage.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [Threading.CancellationToken]::None
    $ws.ConnectAsync($wsUrl, $ct).Wait()

    # Enable all events
    $enable = '{"id":1,"method":"Runtime.enable"}|ConvertTo-Json -Compress'
    $bytes = [Text.Encoding]::UTF8.GetBytes($enable)
    $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, $ct).Wait()

    # Try evaluating window addlistener
    $expr = @{"id"=2;"method"="Runtime.evaluate";"params"=@{"expression"="window.onerror";"returnByValue"=$true}} | ConvertTo-Json -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($expr)
    $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, $ct).Wait()

    $buf = [byte[]]::new(8192)
    $end = (Get-Date).AddSeconds(5)
    $result = ""
    while ($ws.State -eq 'Open' -and (Get-Date) -lt $end) {
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, $ct)
        if ($r.Wait(1000)) {
            $data = [Text.Encoding]::UTF8.GetString($buf,0,$r.Result.Count)
            $result += $data + "`n"
        }
    }
    Write-Host "Events: $result"
    $ws.CloseAsync('NormalClosure', "", $ct).Wait()
} catch {
    Write-Host "Error: $_"
}
