# Diagnostico da instalacao da MEIDA.
#
# IMPORTANTE: este ficheiro e propositadamente SOMENTE ASCII (sem acentos).
# O PowerShell do Windows le ficheiros .ps1 sem BOM como ANSI, e quando o script
# e baixado da internet os acentos sao bytes nao-ASCII e viram "?". Como este script
# pode ser executado numa linha de comando, so ASCII e a unica forma de o
# relatorio sair certo em qualquer PC.
#
# Como executar (a forma mais facil e colar esta linha no PowerShell):
#   iwr -useb https://raw.githubusercontent.com/boda07/meida/main/scripts/diag-instalacao.ps1 | iex *>&1 | Out-File -Encoding utf8 "$env:USERPROFILE\Desktop\meida-diag.txt"; notepad "$env:USERPROFILE\Desktop\meida-diag.txt"

$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'SilentlyContinue'

function Secao($t) {
  Write-Output ""
  Write-Output ("=" * 64)
  Write-Output $t
  Write-Output ("=" * 64)
}
function Info($t) { Write-Output ("  " + $t) }
function Aviso($t) { Write-Output ("  >> " + $t) }
function Problema($t) { Write-Output ("  !! " + $t) }
function Erro($t) { Write-Output ("  XX " + $t) }

# Onde o electron-builder pode ter instalado a app (por utilizador ou para todos).
$caminhos = @(
  "$env:LOCALAPPDATA\Programs\MEIDA",
  "$env:LOCALAPPDATA\Programs\meida",
  "$env:LOCALAPPDATA\Programs\streamapp",
  "$env:LOCALAPPDATA\Programs\MEIDA-Desktop",
  "$env:ProgramFiles\MEIDA",
  "$env:ProgramFiles\meida",
  "${env:ProgramFiles(x86)}\MEIDA",
  "${env:ProgramFiles(x86)}\meida"
)

Secao "1. ONDE ESTA INSTALADA"

$instaladas = @()
foreach ($c in $caminhos) {
  if (Test-Path $c) {
    $instaladas += $c
    $exe = Join-Path $c "MEIDA.exe"
    $temExe = Test-Path $exe
    $ver = "(sem MEIDA.exe)"
    $data = "(desconhecido)"
    if ($temExe) {
      $it = Get-Item $exe
      $ver = $it.VersionInfo.ProductVersion
      $data = $it.LastWriteTime
    }
    Write-Output ("  ENCONTRADA : " + $c)
    Write-Output ("     MEIDA.exe  : " + $temExe + "   versao: " + $ver)
    Write-Output ("     data do exe: " + $data)
    $upd = Join-Path $c "app-update.yml"
    Write-Output ("     app-update.yml presente: " + (Test-Path $upd))
    if (Test-Path $upd) {
      Write-Output "     --- conteudo de app-update.yml ---"
      Get-Content $upd | ForEach-Object { Write-Output ("       " + $_) }
    }
    Write-Output ("     Uninstall MEIDA.exe: " + (Test-Path (Join-Path $c "Uninstall MEIDA.exe")))
    $mb = [math]::Round((Get-ChildItem $c -Recurse -File -ErrorAction SilentlyContinue |
      Measure-Object Length -Sum).Sum / 1MB, 1)
    Write-Output ("     tamanho da pasta: " + $mb + " MB")
  }
}
if ($instaladas.Count -eq 0) {
  Write-Output "  NENHUMA pasta de instalada encontrada nos sitios habituais."
  Write-Output "  (isto por si so ja explica a app nao aparecer: ver secao 3)"
}

Secao "2. ATALHOS (para onde apontam)"
$dirs = @(
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
  "$env:USERPROFILE\Desktop",
  "$env:PUBLIC\Desktop"
)
$ws = New-Object -ComObject WScript.Shell
$partidos = 0
foreach ($d in $dirs) {
  Get-ChildItem -Path $d -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "MEIDA" } |
    ForEach-Object {
      $alvo = $ws.CreateShortcut($_.FullName).TargetPath
      $ok = Test-Path $alvo
      if (-not $ok) { $partidos++ }
      Write-Output ("  " + $_.FullName)
      Write-Output ("     alvo   : " + $alvo)
      Write-Output ("     existe : " + $ok + $(if ($ok) { "" } else { "   <<< ATALHO PARTIDO" }))
    }
}
if ($partidos -eq 0) {
  Write-Output "  nenhum atalho da MEIDA encontrado (ou nenhum partido)."
}

Secao "3. WINDOWS DEFENDER (a app foi posta em quarentena?)"
try {
  $mp = Get-MpComputerStatus -ErrorAction Stop
  Write-Output ("  Defender ligado          : " + $mp.AntivirusEnabled)
  Write-Output ("  Protecao em tempo real   : " + $mp.RealTimeProtectionEnabled)
  Write-Output ("  Ultima analise completa  : " + $mp.QuickScanEndTime)
  $det = Get-MpThreatDetection -ErrorAction SilentlyContinue |
    Where-Object { ($_.Resources -join " ") -match "MEIDA|meida" }
  if ($det) {
    Write-Output "  *** A MEIDA FOI DETECTADA. Detalhes: ***"
    $det | Select-Object -First 8 | ForEach-Object {
      Write-Output ("     " + $_.InitialDetectionTime + "  " + $_.ThreatID)
      ($_.Resources | Select-Object -First 3) | ForEach-Object { Write-Output ("        " + $_) }
    }
  } else {
    Write-Output "  nenhuma deteccao da MEIDA."
  }
  $pref = Get-MpPreference -ErrorAction SilentlyContinue
  if ($pref) {
    $excl = @($pref.ExclusionPath) + @($pref.ExclusionProcess) |
      Where-Object { $_ -notmatch "Must be an administrator" }
    Write-Output ("  exclusoes configuradas   : " + $(if ($excl.Count) { ($excl -join "; ") } else { "(nenhuma, ou ver exige administrador)" }))
  }
} catch {
  Write-Output ("  nao foi possivel ler o Defender: " + $_.Exception.Message)
}

Secao "4. CACHE DO AUTO-UPDATE (ficou um instalador a meio?)"
$updir = "$env:LOCALAPPDATA\meida-updater"
if (Test-Path $updir) {
  Get-ChildItem $updir -Recurse -File -ErrorAction SilentlyContinue |
    Select-Object -First 20 |
    ForEach-Object { Write-Output ("  " + $_.FullName.Replace($updir, "~") + "   " + $_.Length + " bytes") }
} else {
  Write-Output "  sem cache do updater (nunca atualizou sozinho, ou foi limpo)."
}
# O electron-updater tambem pode deixar um instalador a meio no %TEMP%
Get-ChildItem $env:TEMP -Filter "*MEIDA*" -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match "Setup|\.exe$|\.tmp$" } |
  Select-Object -First 5 |
  ForEach-Object { Write-Output ("  TEMP: " + $_.Name + "   " + $_.Length + " bytes") }

Secao "5. PROCESSOS MEIDA / NODE A CORRER"
$p = Get-Process -Name "MEIDA" -ErrorAction SilentlyContinue
if ($p) { $p | ForEach-Object { Write-Output ("  PID " + $_.Id + "  " + $_.Path) } }
else { Write-Output "  nenhum processo MEIDA." }

Secao "6. VERSAO PUBLICADA NO GITHUB"
try {
  $y = Invoke-RestMethod "https://github.com/boda07/meida/releases/latest/download/latest.yml" -TimeoutSec 25
  ($y -split "`n") | ForEach-Object { Write-Output ("  " + $_.TrimEnd()) }
} catch {
  Write-Output ("  nao foi possivel ler: " + $_.Exception.Message)
}

Secao "7. O QUE PODE ESTAR A BLOQUEAR A INSTALACAO"
# Esta seccao e so de LEITURA: nao altera nada no PC.

# 7a. Windows
try {
  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
  Info ("Windows : " + $os.Caption + "  build " + $os.BuildNumber + "." + $os.OSArchitecture)
} catch { Info "Windows : nao foi possivel ler." }

# 7b. Smart App Control (bloqueia executaveis sem assinatura sem aviso)
$sac = "desconhecido"
$k = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" -ErrorAction SilentlyContinue
if ($k -and $null -ne $k.VerifiedAndReputablePolicyState) {
  switch ([int]$k.VerifiedAndReputablePolicyState) {
    1 { $sac = "LIGADO" }
    2 { $sac = "desligado" }
    default { $sac = "estado " + $k.VerifiedAndReputablePolicyState }
  }
}
if ($sac -eq "LIGADO") {
  Problema "Smart App Control: LIGADO"
  Info "Isto BLOQUEIA executaveis sem assinatura digital, sem mostrar aviso nenhum."
  Info "E a causa mais provavel de uma instalacao ficar a meio."
} else {
  Info ("Smart App Control: " + $sac)
}

# 7c. Politicas de Controlo de Aplicacoes (AppLocker / WDAC)
$al = "nenhuma encontrada"
try {
  $pol = Get-AppLockerPolicy -Effective -ErrorAction Stop | Select-Object -ExpandProperty Collection
  if ($pol) {
    $al = ($pol | ForEach-Object { $_.Name + " (modo: " + $_.EnforcementMode + ")" }) -join "; "
  }
} catch {
  $al = "modulo AppLocker nao instalado neste Windows"
}
Info ("Politicas AppLocker/WDAC : " + $al)

# 7d. Registo de eventos: bloqueios reais
$achouEvento = $false
foreach ($log in @("Microsoft-Windows-CodeIntegrity/Operational",
                   "Microsoft-Windows-AppLocker/EXE and DLL",
                   "Microsoft-Windows-AppLocker/MSI and Script")) {
  try {
    $ev = Get-WinEvent -FilterHashtable @{ LogName = $log; StartTime = (Get-Date).AddDays(-30) } `
          -MaxEvents 200 -ErrorAction Stop |
          Where-Object { $_.Message -match "MEIDA|meida|streamapp" }
    if ($ev) {
      $achouEvento = $true
      Info ("BLOQUEIOS registados em " + $log + ":")
      $ev | Select-Object -First 5 | ForEach-Object {
        Info ("   " + $_.TimeCreated.ToString("yyyy-MM-dd HH:mm") + "  id=" + $_.Id)
        Info ("      " + ($_.Message -split "`r?`n" | Select-Object -First 3 | Out-String).Trim().Replace("`r`n", " | "))
      }
    }
  } catch { }
}
if (-not $achouEvento) {
  Info "Nenhum bloqueio da MEIDA no registo de eventos dos ultimos 30 dias."
}

# 7e. Marca "baixado da internet" em ficheiros da MEIDA
foreach ($dir in @("$env:TEMP", "$env:USERPROFILE\Downloads")) {
  Get-ChildItem $dir -Filter "*MEIDA*" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "Setup|\.exe$" } | Select-Object -First 3 | ForEach-Object {
      try {
        Get-Item $_.FullName -Stream Zone.Identifier -ErrorAction Stop | ForEach-Object {
          Info ("marca de 'baixado da net' em " + $_.FileName)
        }
      } catch { }
    }
}

Secao "VEREDITO"
if ($sac -eq "LIGADO") {
  Problema "PROBLEMA ENCONTRADO: o Smart App Control esta ligado."
  Info "Bloqueia o instalador porque a MEIDA ainda nao tem assinatura digital."
  Info "Desligar o Smart App Control e DEFINITIVO (para repor e preciso reinstalar"
  Info "o Windows), por isso nao o recommends a quem nao quer isso no PC."
  Info "A solucao que nao toca no PC e assinar o instalador."
} elseif ($instaladas.Count -eq 0) {
  Write-Output "  A app NAO esta instalada neste PC."
  if ($partidos -gt 0) {
    Write-Output "  Ha atalhos que apontam para ficheiros que nao existem -> e por isso"
    Write-Output "  que o Windows diz que o atalho foi alterado ou removido."
    Write-Output "  SOLUCAO: instalar de novo a partir de"
    Write-Output "  https://github.com/boda07/meida/releases (correr o MEIDA-Setup-X.Y.Z.exe)"
  }
} elseif ($partidos -gt 0) {
  Write-Output "  A app esta instalada MAS ha atalhos partidos -> instalacao a meio."
  Write-Output "  SOLUCAO: correr o instalador outra vez por cima da instalacao atual."
} else {
  Write-Output "  A app esta instalada e os atalhos estao bons."
  Write-Output "  Se ainda assim nao abre, o problema e outro (ver o resto do relatorio)."
}

Write-Output ""
Write-Output "FIM. Manda este ficheiro todo."
