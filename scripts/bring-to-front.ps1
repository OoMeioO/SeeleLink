Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WF {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    public const int SW_RESTORE = 9;
    public const int SW_SHOW = 5;
    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    public static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
    public const uint SWP_NOMOVE = 0x0001;
    public const uint SWP_NOSIZE = 0x0002;
}
"@

$shell = New-Object -ComObject WScript.Shell
$win = $shell.AppActivate("SeeleLink")
Write-Host "AppActivate result: $win"

# Find window by title
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class EnumWin {
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    public static string GetWindowTitle(IntPtr hWnd) {
        int len = GetWindowTextLength(hWnd);
        if (len == 0) return "";
        StringBuilder sb = new StringBuilder(len + 1);
        GetWindowText(hWnd, sb, sb.Capacity);
        return sb.ToString();
    }
}
"@

$hwnd = [IntPtr]::Zero
$enumProc = {
    param($hWnd, $lParam)
    if ([EnumWin]::IsWindowVisible($hWnd)) {
        $title = [EnumWin]::GetWindowTitle($hWnd)
        if ($title -eq "SeeleLink") {
            $script:hwnd = $hWnd
            return $false
        }
    }
    return $true
}

[EnumWin]::EnumWindows($enumProc, [IntPtr]::Zero) | Out-Null

if ($hwnd -ne [IntPtr]::Zero) {
    Write-Host "Found SeeleLink window HWND: $hwnd"
    if ([WF]::IsIconic($hwnd)) {
        [WF]::ShowWindow($hwnd, [WF]::SW_RESTORE) | Out-Null
        Start-Sleep -Milliseconds 200
    }
    [WF]::SetWindowPos($hwnd, [WF]::HWND_TOPMOST, 0, 0, 0, 0, [WF]::SWP_NOMOVE -bor [WF]::SWP_NOSIZE) | Out-Null
    Start-Sleep -Milliseconds 100
    [WF]::SetWindowPos($hwnd, [WF]::HWND_NOTOPMOST, 0, 0, 0, 0, [WF]::SWP_NOMOVE -bor [WF]::SWP_NOSIZE) | Out-Null
    [WF]::SetForegroundWindow($hwnd) | Out-Null
    Write-Host "Done - SeeleLink is now in foreground"
} else {
    Write-Host "Window not found - may be on another virtual desktop"
}
