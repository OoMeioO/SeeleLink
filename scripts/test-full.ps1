$c = New-Object System.Net.Sockets.TcpClient
$c.Connect("127.0.0.1", 9380)
$s = $c.GetStream()
$w = New-Object System.IO.StreamWriter($s)
$r = New-Object System.IO.StreamReader($s)
$w.WriteLine('{"cmd":"status"}')
$w.Flush()
$resp = $r.ReadLine()
$c.Close()
$resp | ConvertFrom-Json | ConvertTo-Json -Depth 4
