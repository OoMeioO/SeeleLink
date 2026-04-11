$ErrorActionPreference = 'SilentlyContinue'
try {
    $pages = Invoke-RestMethod -Uri 'http://localhost:9223/json' -TimeoutSec 3
    $appPage = $pages[1]

    $wsUrl = $appPage.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [Threading.CancellationToken]::None
    $ws.ConnectAsync($wsUrl, $ct).Wait()

    # Enable Runtime.consoleAPICalled event
    $enable = '{"id":1,"method":"Runtime.enable"}'
    $bytes = [Text.Encoding]::UTF8.GetBytes($enable)
    $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, $ct).Wait()

    # Evaluate app() - try to get something
    $expr = @{"id"=2;"method"="Runtime.evaluate";"params"=@{"expression"="window.__REACT_ERRORS__ || 'no errors'";"returnByValue"=$true}} | ConvertTo-Json -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($expr)
    $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, $ct).Wait()

    $buf = [byte[]]::new(16384)
    $end = (Get-Date).AddSeconds(8)
    $results = @()
    while ($ws.State -eq 'Open' -and (Get-Date) -lt $end) {
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, $ct)
        if ($r.Wait(500) -and $r.Result.Count -gt 0) {
            $data = [Text.Encoding]::UTF8.GetString($buf,0,$r.Result.Count)
            $results += $data
        }
    }
    Write-Host "Messages received: $($results.Count)"
    $results | ForEach-Object { Write-Host $_ }
    $ws.CloseAsync('NormalClosure', "", $ct).Wait()
} catch {
    Write-Host "Error: $_"
}
