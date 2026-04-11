$ErrorActionPreference = 'SilentlyContinue'
try {
    $pages = Invoke-RestMethod -Uri 'http://localhost:9222/json' -TimeoutSec 3
    $appPage = $pages[0]

    $wsUrl = $appPage.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [Threading.CancellationToken]::None
    $ws.ConnectAsync($wsUrl, $ct).Wait()

    # Check window error
    $expr = @{"id"=1;"method"="Runtime.evaluate";"params"=@{"expression"="window.onerror ? `"has error handler`" : `"no handler`"";"returnByValue"=$true}} | ConvertTo-Json -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($expr)
    $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, $ct).Wait()
    $buf = [byte[]]::new(4096)
    $end = (Get-Date).AddSeconds(5)
    $result = ""
    while ($ws.State -eq 'Open' -and (Get-Date) -lt $end) {
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, $ct)
        if ($r.Wait(1000) -and $r.Result.Count -gt 0) {
            $result += [Text.Encoding]::UTF8.GetString($buf,0,$r.Result.Count)
            break
        }
    }
    Write-Host "onerror: $result"

    # Check window dimensions
    $expr2 = @{"id"=2;"method"="Runtime.evaluate";"params"=@{"expression"="window.innerWidth + 'x' + window.innerHeight";"returnByValue"=$true}} | ConvertTo-Json -Compress
    $bytes2 = [Text.Encoding]::UTF8.GetBytes($expr2)
    $ws.SendAsync([ArraySegment[byte]]$bytes2, 'Text', $true, $ct).Wait()
    $buf2 = [byte[]]::new(4096)
    $end2 = (Get-Date).AddSeconds(5)
    $result2 = ""
    while ($ws.State -eq 'Open' -and (Get-Date) -lt $end2) {
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf2, $ct)
        if ($r.Wait(1000) -and $r.Result.Count -gt 0) {
            $result2 += [Text.Encoding]::UTF8.GetString($buf2,0,$r.Result.Count)
            break
        }
    }
    Write-Host "Window size: $result2"

    # Check if #root has any content
    $expr3 = @{"id"=3;"method"="Runtime.evaluate";"params"=@{"expression"="document.getElementById(`"root`").children.length + ' children, ' + document.getElementById(`"root`").innerHTML.length + ' chars`"";"returnByValue"=$true}} | ConvertTo-Json -Compress
    $bytes3 = [Text.Encoding]::UTF8.GetBytes($expr3)
    $ws.SendAsync([ArraySegment[byte]]$bytes3, 'Text', $true, $ct).Wait()
    $buf3 = [byte[]]::new(4096)
    $end3 = (Get-Date).AddSeconds(5)
    $result3 = ""
    while ($ws.State -eq 'Open' -and (Get-Date) -lt $end3) {
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf3, $ct)
        if ($r.Wait(1000) -and $r.Result.Count -gt 0) {
            $result3 += [Text.Encoding]::UTF8.GetString($buf3,0,$r.Result.Count)
            break
        }
    }
    Write-Host "Root: $result3"

    $ws.CloseAsync('NormalClosure', "", $ct).Wait()
} catch {
    Write-Host "Error: $_"
}
