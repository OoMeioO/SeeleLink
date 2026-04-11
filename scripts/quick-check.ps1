$ErrorActionPreference = 'SilentlyContinue'
try {
    $pages = Invoke-RestMethod -Uri 'http://localhost:9222/json' -TimeoutSec 3
    $appPage = $pages[0]

    $wsUrl = $appPage.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [Threading.CancellationToken]::None
    $ws.ConnectAsync($wsUrl, $ct).Wait()

    # Simple eval test
    $expr = '{"id":1,"method":"Runtime.evaluate","params":{"expression":"1+1","returnByValue":true}}'
    $bytes = [Text.Encoding]::UTF8.GetBytes($expr)
    $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, $ct).Wait()
    $buf = [byte[]]::new(4096)
    $end = (Get-Date).AddSeconds(5)
    $result = ""
    while ($ws.State -eq 'Open' -and (Get-Date) -lt $end) {
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, $ct)
        if ($r.Wait(1000) -and $r.Result.Count -gt 0) {
            $result = [Text.Encoding]::UTF8.GetString($buf,0,$r.Result.Count)
            break
        }
    }
    Write-Host "1+1 result: $result"

    # Check #root dimensions
    $expr2 = '{"id":2,"method":"Runtime.evaluate","params":{"expression":"document.getElementById(`"root`").getBoundingClientRect().width + `",`" + document.getElementById(`"root`").getBoundingClientRect().height","returnByValue":true}}'
    $bytes2 = [Text.Encoding]::UTF8.GetBytes($expr2)
    $ws.SendAsync([ArraySegment[byte]]$bytes2, 'Text', $true, $ct).Wait()
    $buf2 = [byte[]]::new(4096)
    $end2 = (Get-Date).AddSeconds(5)
    $result2 = ""
    while ($ws.State -eq 'Open' -and (Get-Date) -lt $end2) {
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf2, $ct)
        if ($r.Wait(1000) -and $r.Result.Count -gt 0) {
            $result2 = [Text.Encoding]::UTF8.GetString($buf2,0,$r.Result.Count)
            break
        }
    }
    Write-Host "Root rect: $result2"

    $ws.CloseAsync('NormalClosure', "", $ct).Wait()
} catch {
    Write-Host "Error: $_"
}
