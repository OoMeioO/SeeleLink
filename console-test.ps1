$ErrorActionPreference = 'SilentlyContinue'
try {
    $pages = Invoke-RestMethod -Uri 'http://localhost:9222/json' -TimeoutSec 3
    $appPage = $pages[0]

    $wsUrl = $appPage.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [Threading.CancellationToken]::None
    $ws.ConnectAsync($wsUrl, $ct).Wait()

    # Inject a console.log listener before evaluating
    $enable = '{"id":1,"method":"Log.enable"}'
    $bytes = [Text.Encoding]::UTF8.GetBytes($enable)
    $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, $ct).Wait()

    # Evaluate and trigger console output
    $expr = '{"id":2,"method":"Runtime.evaluate","params":{"expression":"console.log(`"TEST FROM RENDERER`")","returnByValue":true}}'
    $bytes2 = [Text.Encoding]::UTF8.GetBytes($expr)
    $ws.SendAsync([ArraySegment[byte]]$bytes2, 'Text', true, $ct).Wait()

    # Wait for log event
    $buf = [byte[]]::new(16384)
    $end = (Get-Date).AddSeconds(5)
    $found = $false
    while ($ws.State -eq 'Open' -and (Get-Date) -lt $end) {
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, $ct)
        if ($r.Wait(500) -and $r.Result.Count -gt 0) {
            $data = [Text.Encoding]::UTF8.GetString($buf,0,$r.Result.Count)
            if ($data -match "TEST FROM RENDERER") {
                Write-Host "CONSOLE LOG WORKS: $data"
                $found = $true
                break
            }
        }
    }
    if (-not $found) { Write-Host "No console log received in 5s - JS not executing properly" }

    $ws.CloseAsync('NormalClosure', "", $ct).Wait()
} catch {
    Write-Host "Error: $_"
}
