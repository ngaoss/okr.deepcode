$ErrorActionPreference = "SilentlyContinue"
$NODE_PATH = "d:\OKR-Project-main\node-lts\node.exe"
$SERVER_JS = "server.js"

Write-Host "--- KHOI DONG HE THONG OKR ---" -ForegroundColor Cyan
Write-Host "Dang su dung Node.js LTS v22.14.0"

while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Dang khoi chay Server..." -ForegroundColor Yellow
    
    # Thiet lap NODE_OPTIONS de tang bo nho
    $env:NODE_OPTIONS = "--max-old-space-size=4096"
    
    # Chay server va cho doi
    $process = Start-Process -FilePath $NODE_PATH -ArgumentList $SERVER_JS -NoNewWindow -PassThru -Wait
    
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Server da dung (Exit Code: $($process.ExitCode)). Dang khoi dong lai sau 3 giay..." -ForegroundColor Red
    Start-Sleep -Seconds 3
}
