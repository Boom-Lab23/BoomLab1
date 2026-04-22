# Script PowerShell para criar keystore BoomLab
# Usage: .\scripts\create-keystore.ps1
#
# Procura automaticamente o keytool.exe e cria o keystore em:
#   android/app/boomlab-release-key.keystore

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== BoomLab Keystore Creator ===" -ForegroundColor Cyan
Write-Host ""

# 1. Encontrar keytool.exe
Write-Host "1/4 - A procurar keytool.exe..." -ForegroundColor Yellow

$possiblePaths = @(
    "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe",
    "C:\Program Files (x86)\Android\Android Studio\jbr\bin\keytool.exe",
    "$env:LOCALAPPDATA\Programs\Android Studio\jbr\bin\keytool.exe",
    "$env:USERPROFILE\AppData\Local\Programs\Android Studio\jbr\bin\keytool.exe"
)

$keytool = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $keytool = $path
        Write-Host "    Encontrado: $keytool" -ForegroundColor Green
        break
    }
}

if (-not $keytool) {
    Write-Host "    keytool.exe NAO encontrado nos locais habituais. A procurar no sistema..." -ForegroundColor Yellow
    $found = Get-ChildItem -Path "C:\","$env:LOCALAPPDATA","$env:PROGRAMFILES" -Filter "keytool.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $keytool = $found.FullName
        Write-Host "    Encontrado: $keytool" -ForegroundColor Green
    } else {
        Write-Host "    ERRO: keytool.exe nao encontrado. Verifica que o Android Studio esta instalado." -ForegroundColor Red
        exit 1
    }
}

# 2. Destino
$keystorePath = Join-Path $PSScriptRoot "..\android\app\boomlab-release-key.keystore"
$keystorePath = [System.IO.Path]::GetFullPath($keystorePath)

Write-Host ""
Write-Host "2/4 - Path do keystore:" -ForegroundColor Yellow
Write-Host "    $keystorePath"

# 3. Verificar se ja existe
if (Test-Path $keystorePath) {
    Write-Host ""
    Write-Host "AVISO: Keystore ja existe em $keystorePath" -ForegroundColor Yellow
    $confirm = Read-Host "Queres substituir? (s/N)"
    if ($confirm -ne "s" -and $confirm -ne "S") {
        Write-Host "Abortado pelo utilizador." -ForegroundColor Yellow
        exit 0
    }
    Remove-Item $keystorePath
}

# 4. Pedir password
Write-Host ""
Write-Host "3/4 - Password do keystore" -ForegroundColor Yellow
Write-Host "    IMPORTANTE: Anota esta password num sitio seguro!"
Write-Host "    Precisas dela sempre que quiseres publicar updates da app."
Write-Host ""
$securePass = Read-Host "Password (min 6 chars)" -AsSecureString
$pass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass))

if ($pass.Length -lt 6) {
    Write-Host "ERRO: Password tem de ter pelo menos 6 caracteres." -ForegroundColor Red
    exit 1
}

# 5. Criar keystore
Write-Host ""
Write-Host "4/4 - A criar keystore..." -ForegroundColor Yellow

$dname = "CN=Guilherme Freitas, OU=BoomLab, O=Boomlab Agency OU, L=Tallinn, ST=Harjumaa, C=EE"

& $keytool -genkeypair -v `
    -keystore $keystorePath `
    -alias boomlab `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -dname $dname `
    -storepass $pass `
    -keypass $pass

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERRO: keytool falhou. Ver output acima." -ForegroundColor Red
    exit 1
}

# 6. Confirmar
Write-Host ""
Write-Host "=== SUCESSO ===" -ForegroundColor Green
Write-Host "Keystore criado em: $keystorePath"
$fileInfo = Get-Item $keystorePath
Write-Host "Tamanho: $($fileInfo.Length) bytes"
Write-Host ""
Write-Host "IMPORTANTE:" -ForegroundColor Yellow
Write-Host "  1. Faz backup deste ficheiro AGORA (Google Drive, email, etc.)"
Write-Host "  2. Guarda a password num password manager (Bitwarden, 1Password)"
Write-Host "  3. NAO commites este ficheiro no Git (ja esta no .gitignore)"
Write-Host ""

# 7. Oferece fazer backup
$backupPath = Join-Path $env:USERPROFILE "Documents\boomlab-keystore-backup-$(Get-Date -Format 'yyyyMMdd').keystore"
Write-Host "Backup sugerido em: $backupPath"
$confirm = Read-Host "Fazer backup agora? (s/N)"
if ($confirm -eq "s" -or $confirm -eq "S") {
    Copy-Item $keystorePath $backupPath
    Write-Host "Backup OK: $backupPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "Pronto! Proximo passo: configurar build.gradle para usar este keystore." -ForegroundColor Cyan
Write-Host ""
