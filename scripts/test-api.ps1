$client = New-Object System.Net.Sockets.TcpClient
$client.Connect("127.0.0.1", 9380)
$stream = $client.GetStream()
$writer = New-Object System.IO.StreamWriter($stream)
$reader = New-Object System.IO.StreamReader($stream)
$writer.WriteLine('{"cmd":"ping"}')
$writer.Flush()
$response = $reader.ReadLine()
$client.Close()
Write-Host $response
