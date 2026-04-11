Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$bitmap = New-Object System.Drawing.Bitmap([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen(0, 0, 0, 0, $bitmap.Size)
$bitmap.Save("F:\worksapce\github\SeeleLink\screenshot.png")
$graphics.Dispose()
$bitmap.Dispose()
Write-Host "Screenshot saved"
