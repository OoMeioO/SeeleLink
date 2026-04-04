$ErrorActionPreference = 'SilentlyContinue'
try {
    $pages = Invoke-RestMethod -Uri 'http://localhost:9222/json' -TimeoutSec 3
    $appPage = $pages[0]

    $wsUrl = $appPage.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [Threading.CancellationToken]::None
    $ws.ConnectAsync($wsUrl, $ct).Wait()

    # Enable Page.loadingFailed
    $enable = '{"id":1,"method":"Page.enable"}'
    $bytes = [Text.Encoding]::UTF8.GetBytes($enable)
    $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, $ct).Wait()

    # Also enable Runtime exceptions
    $enable2 = '{"id":2,"method":"Runtime.enable"}'
    $bytes2 = [Text.Encoding]::UTF8.GetBytes($enable2)
    $ws.SendAsync([ArraySegment[byte]]$bytes2, 'Text', $true, $ct).Wait()

    # Try evaluating something simple
    $expr = @{"id"=3;"method"="Runtime.evaluate";"params"=@{"expression"="1+1";"returnByValue"=$true}} | ConvertTo-Json -Compress
    $bytes3 = [Text.Encoding]::UTF8.GetBytes($expr)
    $ws.SendAsync([ArraySegment[byte]]$bytes3, 'Text', $true, $ct).Wait()

    $buf = [byte[]]::new(16384)
    $end = (Get-Date).AddSeconds(5)
    $results = @()
    while ($ws.State -eq 'Open' -and (Get-Date) -lt $end) {
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, $ct)
        if ($r.Wait(500) -and $r.Result.Count -gt 0) {
            $data = [Text.Encoding]::UTF8.GetString($buf,0,$r.Result.Count)
            $results += $data
        }
    }
    Write-Host "Events received: $($results.Count)"
    $results | ForEach-Object { Write-Host $_ }
    $ws.CloseAsync('NormalClosure', "", $ct).Wait()
} catch {
    Write-Host "Error: $_"
}
