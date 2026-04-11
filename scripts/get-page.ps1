param([string]$pageId, [string]$expression)
$body = @{id=1;method="Runtime.evaluate";params=@{expression=$expression;returnByValue=$true}} | ConvertTo-Json
$headers = @{"Content-Type"="application/json"}
try {
    $resp = Invoke-RestMethod -Uri "http://localhost:9222/json" -TimeoutSec 3
    if ($resp.Count -eq 0) { Write-Host "No pages found"; exit 1 }
    $targetUrl = $resp[0].webSocketDebuggerUrl
    Write-Host "Page: $($resp[0].title) - $($resp[0].url)"
} catch {
    Write-Host "Error getting pages: $_"
}
