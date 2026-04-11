$ErrorActionPreference = 'SilentlyContinue'
try {
    $pages = Invoke-RestMethod -Uri 'http://localhost:9222/json' -TimeoutSec 3
    Write-Host "Total pages: $($pages.Count)"
    for ($i = 0; $i -lt $pages.Count; $i++) {
        Write-Host "Page $i : title='$($pages[$i].title)' url='$($pages[$i].url)' type='$($pages[$i].type)'"
    }
} catch {
    Write-Host "Error: $_"
}
