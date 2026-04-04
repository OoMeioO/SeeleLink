$ErrorActionPreference = 'SilentlyContinue'
$headers = @{'Content-Type' = 'application/json'}
$body = '{"id":1,"method":"Runtime.evaluate","params":{"expression":"document.getElementById(\"root\").innerHTML.substring(0,300)","returnByValue":true}}'

try {
    $pages = Invoke-RestMethod -Uri 'http://localhost:9222/json' -TimeoutSec 3
    if ($pages.Count -eq 0) {
        Write-Host "No pages"
        exit 1
    }
    Write-Host "Page: $($pages[0].title)"
    Write-Host "URL: $($pages[0].url)"

    $wsUrl = $pages[0].webSocketDebuggerUrl
    Write-Host "WS: $wsUrl"
} catch {
    Write-Host "Error: $_"
}
