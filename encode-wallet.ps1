$files = @('cwallet.sso', 'tnsnames.ora', 'sqlnet.ora', 'ewallet.pem')
$walletDir = 'C:\Users\T933261\oracle_wallet'

Write-Output "======================================================================"
Write-Output "Oracle Wallet Base64 Encoder for Vercel"
Write-Output "======================================================================"
Write-Output ""

foreach ($file in $files) {
    $path = Join-Path $walletDir $file

    if (Test-Path $path) {
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $base64 = [Convert]::ToBase64String($bytes)
        $envVarName = 'ORACLE_WALLET_' + $file.Replace('.', '_').ToUpper()

        Write-Output "----------------------------------------------------------------------"
        Write-Output "File: $file"
        Write-Output "Environment Variable Name: $envVarName"
        Write-Output "Size: $([math]::Round($base64.Length / 1024, 2)) KB"
        Write-Output "----------------------------------------------------------------------"
        Write-Output $base64
        Write-Output ""
    } else {
        Write-Output "ERROR: File not found: $path"
        Write-Output ""
    }
}

Write-Output "======================================================================"
Write-Output "Add each environment variable above to Vercel:"
Write-Output "1. Go to Vercel project settings"
Write-Output "2. Navigate to Environment Variables"
Write-Output "3. Add each ORACLE_WALLET_* variable with its base64 value"
Write-Output "======================================================================"
