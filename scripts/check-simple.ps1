$ErrorActionPreference = 'SilentlyContinue'
try {
    $pages = Invoke-RestMethod -Uri 'http://localhost:9222/json' -TimeoutSec 3
    $appPage = $pages | Where-Object { $_.type -eq 'page' -and $_.url -notlike "devtools://*" }
    if (-not $appPage) { Write-Host "No app page"; exit 1 }

    $wsUrl = $appPage.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [Threading.CancellationToken]::None
    $ws.ConnectAsync($wsUrl, $ct).Wait()

    $msg = '{"id":1,"method":"Runtime.evaluate","params":{"expression":"1+1","returnByValue":true}}'
    $bytes = [Text.Encoding]::UTF8.GetBytes($msg)
    $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, $ct).Wait()
    $buf = [byte[]]::new(4096)
    $end = (Get-Date).AddSeconds(5)
    $result = ""
    while ($ws.State -eq 'Open' -and (Get-Date) -lt $end) {
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, $ct)
        if ($r.Wait(2000) -and $r.Result.Count -gt 0) {
            $result += [Text.Encoding]::UTF8.GetString($buf,0,$r.Result.Count)
            break
        }
    }
    Write-Host "Result: $result"
    $ws.CloseAsync('NormalClosure', "", $ct).Wait()
} catch {
    Write-Host "Error: $_"
}
