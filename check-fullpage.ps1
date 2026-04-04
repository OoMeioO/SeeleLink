$ErrorActionPreference = 'SilentlyContinue'
try {
    $pages = Invoke-RestMethod -Uri 'http://localhost:9223/json' -TimeoutSec 3
    $appPage = $pages | Where-Object { $_.type -eq 'page' -and $_.url -notlike "devtools://*" -and $_.url -notlike "http://localhost:5173*" }
    if (-not $appPage) {
        # Maybe only one page
        $appPage = $pages[0]
    }
    if (-not $appPage) { Write-Host "No pages"; exit 1 }

    Write-Host "App page: $($appPage.title) URL: $($appPage.url)"

    $wsUrl = $appPage.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [Threading.CancellationToken]::None
    $ws.ConnectAsync($wsUrl, $ct).Wait()

    # Evaluate document.documentElement.innerHTML (full page)
    $expr = @{"id"=1;"method"="Runtime.evaluate";"params"=@{"expression"="document.documentElement.innerHTML.substring(0,1000)";"returnByValue"=$true}} | ConvertTo-Json -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($expr)
    $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, $ct).Wait()

    $buf = [byte[]]::new(8192)
    $end = (Get-Date).AddSeconds(5)
    $result = ""
    while ($ws.State -eq 'Open' -and (Get-Date) -lt $end) {
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, $ct)
        if ($r.Wait(2000) -and $r.Result.Count -gt 0) {
            $result += [Text.Encoding]::UTF8.GetString($buf,0,$r.Result.Count)
            break
        }
    }
    Write-Host "Page HTML (first 1000): $result"
    $ws.CloseAsync('NormalClosure', "", $ct).Wait()
} catch {
    Write-Host "Error: $_"
}
