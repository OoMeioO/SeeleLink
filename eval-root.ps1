$ErrorActionPreference = 'SilentlyContinue'
$headers = @{'Content-Type' = 'application/json'}

try {
    $pages = Invoke-RestMethod -Uri 'http://localhost:9222/json' -TimeoutSec 3
    if ($pages.Count -eq 0) { Write-Host "No pages found"; exit 1 }

    # Find the actual app page (not DevTools)
    $appPage = $pages | Where-Object { $_.type -eq 'page' -and $_.url -notlike "devtools://*" }
    if ($appPage) {
        Write-Host "App page title: $($appPage.title)"
        Write-Host "App page URL: $($appPage.url)"
        $wsUrl = $appPage.webSocketDebuggerUrl

        # Use WebSocket via .NET
        $ws = New-Object System.Net.WebSockets.ClientWebSocket
        $ct = [Threading.CancellationToken]::None
        $ws.ConnectAsync($wsUrl, $ct).Wait()
        $msg = '{"id":1,"method":"Runtime.evaluate","params":{"expression":"document.getElementById(\"root\").innerHTML.substring(0,300)","returnByValue":true}}'
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
        Write-Host "Root HTML: $result"
        $ws.CloseAsync('NormalClosure', "", $ct).Wait()
    } else {
        Write-Host "No app page found. All pages:"
        $pages | ForEach-Object { Write-Host "  $($_.title) - $($_.url) - $($_.type)" }
    }
} catch {
    Write-Host "Error: $_"
}
