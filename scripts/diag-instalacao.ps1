# Diagnostico da instalacao da MEIDA. Cola isto no PowerShell do PC afetado
# (botao direito no Menu Iniciar > Terminal/PowerShell) e manda o resultado.
$ProgressPreference = 'SilentlyContinue'

function linha($t) { Write-Output ""; Write-Output ("=" * 62); Write-Output $t; Write-Output ("=" * 62) }

linha "1. ONDE ESTA INSTALADA"
$caminhos = @(
  "$env:LOCALAPPDATA\Programs\MEIDA",
  "$env:LOCALAPPDATA\Programs\meida",
  "$env:LOCALAPPDATA\Programs\streamapp",
  "$env:ProgramFiles\MEIDA",
  "${env:ProgramFiles(x86)}\MEIDA",
  "$env:LOCALAPPDATA\MEIDA"
)
$visto = $false
foreach ($c in $caminhos) {
  if (Test-Path $c) {
    $visto = $true
    $exe = Join-Path $c "MEIDA.exe"
    $ver = if (Test-Path $exe) { (Get-Item $exe).VersionInfo.ProductVersion } else { "(sem MEIDA.exe)" }
    Write-Output ("  ENCONTRADA: " + $c)
    Write-Output ("     MEIDA.exe presente : " + (Test-Path $exe))
    Write-Output ("     versao do exe      : " + $ver)
    $upd = Join-Path $c "app-update.yml"
    Write-Output ("     app-update.yml     : " + (Test-Path $upd))
    if (Test-Path $upd) {
      Write-Output "     --- conteudo de app-update.yml ---"
      Get-Content $upd | ForEach-Object { Write-Output ("       " + $_) }
    }
    $unins = Join-Path $c "Uninstall MEIDA.exe"
    Write-Output ("     desinstalador      : " + (Test-Path $unins))
    Write-Output ("     tamanho da pasta   : " + [math]::Round((Get-ChildItem $c -Recurse -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB, 1) + " MB")
  }
}
if (-not $visto) { Write-Output "  NENHUMA pasta de instalacao encontrada nos sitios habituais." }

linha "2. ATALHOS (o que apontam)"
$dirs = @(
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
  "$env:USERPROFILE\Desktop",
  "$env:PUBLIC\Desktop"
)
$shell = New-Object -ComObject WScript.Shell
foreach ($d in $dirs) {
  Get-ChildItem -Path $d -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "MEIDA" } |
    ForEach-Object {
      $lnk = $shell.CreateShortcut($_.FullName)
      $alvo = $lnk.TargetPath
      $existe = Test-Path $alvo
      Write-Output ("  " + $_.FullName)
      Write-Output ("     alvo   : " + $alvo)
      Write-Output ("     existe : " + $existe + $(if ($existe) { "" } else { "   <<< ESTE E' O ATALHO PARTIDO" }))
    }
}

linha "3. DEFENDER (a app foi posta em quarantena?)"
try {
  $mp = Get-MpComputerStatus -ErrorAction Stop
  Write-Output ("  Defender ligado        : " + $mp.AntivirusEnabled)
  Write-Output ("  Ultima analise completa: " + $mp.QuickScanEndTime)
  Write-Output ("  -- deteções --")
  $d = Get-MpThreatDetection -ErrorAction SilentlyContinue |
       Where-Object { ($_.Resources -join " ") -match "MEIDA|meida" }
  if ($d) {
    $d | Select-Object -First 8 | ForEach-Object {
      Write-Output ("     " + $_.InitialDetectionTime + "  " + $_.ThreatID)
      ($_.Resources | Select-Object -First 3) | ForEach-Object { Write-Output ("        " + $_) }
    }
  } else { Write-Output "     nenhuma deteicao da MEIDA." }
} catch { Write-Output ("  nao foi possivel ler o Defender: " + $_.Exception.Message) }

linha "4. CACHE DO AUTO-UPDATE (ficou um instalador a meio?)"
$updir = "$env:LOCALAPPDATA\meida-updater"
if (Test-Path $updir) {
  Get-ChildItem $updir -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 20 |
    ForEach-Object { Write-Output ("  " + $_.FullName.Replace($updir, '~') + "   " + $_.Length + " bytes") }
} else { Write-Output "  sem cache do updater (nunca atualizou sozinho, ou foi limpo)." }

linha "5. PROCESSOS MEIDA A CORRER"
$p = Get-Process -Name "MEIDA" -ErrorAction SilentlyContinue
if ($p) { $p | ForEach-Object { Write-Output ("  PID " + $_.Id + "  " + $_.Path) } }
else { Write-Output "  nenhum." }

linha "6. VERSAO PUBLICADA NO GITHUB"
try {
  $y = Invoke-RestMethod "https://github.com/boda07/meida/releases/latest/download/latest.yml" -TimeoutSec 20
  Write-Output "  --- latest.yml publico ---"
  ($y -split "`n") | ForEach-Object { Write-Output ("    " + $_.TrimEnd()) }
} catch { Write-Output ("  nao foi possivel ler: " + $_.Exception.Message) }

Write-Output ""
Write-Output "FIM. Manda isto tudo."
