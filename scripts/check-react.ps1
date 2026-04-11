$ErrorActionPreference = 'SilentlyContinue'
try {
    $pages = Invoke-RestMethod -Uri 'http://localhost:9223/json' -TimeoutSec 3
    $appPage = $pages[1]

    $wsUrl = $appPage.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [Threading.CancellationToken]::None
    $ws.ConnectAsync($wsUrl, $ct).Wait()

    # Check if React exists
    $expr = @{"id"=1;"method"="Runtime.evaluate";"params"=@{"expression"="typeof window.React";"returnByValue"=$true}} | ConvertTo-Json -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($expr)
    $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, $ct).Wait()

    $buf = [byte[]]::new(2048)
    $end = (Get-Date).AddSeconds(5)
    $result = ""
    while ($ws.State -eq 'Open' -and (Get-Date) -lt $end) {
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, $ct)
        if ($r.Wait(1000) -and $r.Result.Count -gt 0) {
            $result += [Text.Encoding]::UTF8.GetString($buf,0,$r.Result.Count)
            break
        }
    }
    Write-Host "React: $result"

    # Also check #root children
    $expr2 = @{"id"=2;"method"="Runtime.evaluate";"params"=@{"expression"="document.getElementById(`"root`").children.length";"returnByValue"=$true}} | ConvertTo-Json -Compress
    $bytes2 = [Text.Encoding]::UTF8.GetBytes($expr2)
    $ws.SendAsync([ArraySegment[byte]]$bytes2, 'Text', $true, $ct).Wait()
    $result2 = ""
    $end2 = (Get-Date).AddSeconds(5)
    while ($ws.State -eq 'Open' -and (Get-Date) -lt $end2) {
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, $ct)
        if ($r.Wait(1000) -and $r.Result.Count -gt 0) {
            $result2 += [Text.Encoding]::UTF8.GetString($buf,0,$r.Result.Count)
            break
        }
    }
    Write-Host "Root children: $result2"

    # Check __reactRootContainer
    $expr3 = @{"id"=3;"method"="Runtime.evaluate";"params"=@{"expression"="document.getElementById(`"root`")._reactRootContainer";"returnByValue"=$true}} | ConvertTo-Json -Compress
    $bytes3 = [Text.Encoding]::UTF8.GetBytes($expr3)
    $ws.SendAsync([ArraySegment[byte]]$bytes3, 'Text', $true, $ct).Wait()
    $result3 = ""
    $end3 = (Get-Date).AddSeconds(5)
    while ($ws.State -eq 'Open' -and (Get-Date) -lt $end3) {
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, $ct)
        if ($r.Wait(1000) -and $r.Result.Count -gt 0) {
            $result3 += [Text.Encoding]::UTF8.GetString($buf,0,$r.Result.Count)
            break
        }
    }
    Write-Host "ReactRootContainer: $result3"

    $ws.CloseAsync('NormalClosure', "", $ct).Wait()
} catch {
    Write-Host "Error: $_"
}
