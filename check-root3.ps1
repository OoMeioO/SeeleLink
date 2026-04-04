$ErrorActionPreference = 'SilentlyContinue'
try {
    $pages = Invoke-RestMethod -Uri 'http://localhost:9223/json' -TimeoutSec 3
    $appPage = $pages[1]  # SeeleLink page
    Write-Host "Using: $($appPage.title)"

    $wsUrl = $appPage.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [Threading.CancellationToken]::None
    $ws.ConnectAsync($wsUrl, $ct).Wait()

    # Check #root innerHTML
    $expr = @{"id"=1;"method"="Runtime.evaluate";"params"=@{"expression"="document.getElementById(`"root`").innerHTML.substring(0,500)";"returnByValue"=$true}} | ConvertTo-Json -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($expr)
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
} catch {
    Write-Host "Error: $_"
}
