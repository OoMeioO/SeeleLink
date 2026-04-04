$ErrorActionPreference = 'SilentlyContinue'
try {
    $pages = Invoke-RestMethod -Uri 'http://localhost:9222/json' -TimeoutSec 3
    $appPage = $pages[0]

    $wsUrl = $appPage.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [Threading.CancellationToken]::None
    $ws.ConnectAsync($wsUrl, $ct).Wait()

    # Check React root
    $expr = @{"id"=1;"method"="Runtime.evaluate";"params"=@{"expression"="document.getElementById(`"root`")._reactRootContainer ? `"found`" : `"not found`"";"returnByValue"=$true}} | ConvertTo-Json -Compress
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
    Write-Host "ReactRootContainer: $result"

    # Check body children
    $expr2 = @{"id"=2;"method"="Runtime.evaluate";"params"=@{"expression"="document.body.childElementCount";"returnByValue"=$true}} | ConvertTo-Json -Compress
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
    Write-Host "Body children: $result2"

    # Check console messages (listen for errors)
    $expr3 = @{"id"=3;"method"="Runtime.evaluate";"params"=@{"expression"="window.__reactError || `"no error`"";"returnByValue"=$true}} | ConvertTo-Json -Compress
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
    Write-Host "React error: $result3"

    $ws.CloseAsync('NormalClosure', "", $ct).Wait()
} catch {
    Write-Host "Error: $_"
}
