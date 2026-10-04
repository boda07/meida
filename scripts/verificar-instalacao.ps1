# Descobre porque e que o instalador acaba mas o MEIDA.exe nao fica.
# So de leitura: nao apaga nada, nao instala nada, nao muda nada no PC.
#
# Corre depois de o script de reparar falhar. Cola o resultado para o autor.

$ErrorActionPreference = "Continue"
$repo = "https://github.com/boda07/meida"

function Secao($t) { Write-Output ""; Write-Output ("=== " + $t + " ===") }
function Info($t)  { Write-Output ("   " + $t) }
function Aviso($t){ Write-Output ("   !  " + $t) }
function Erro($t)  { Write-Output ("   X  " + $t) }
function Bom($t)   { Write-Output ("   ok " + $t) }

Secao "MEIDA - VERIFICAR A INSTALACAO"
Info ("data e hora de agora : " + (Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))

# ------------------------------------------------------- 1. onde esta?
Secao "1. A APP ESTA ALGUM LADO?"
$caminhos = @(
  "$env:LOCALAPPDATA\Programs\streamapp",
  "$env:LOCALAPPDATA\Programs\MEIDA",
  "$env:LOCALAPPDATA\Programs\meida",
  "$env:ProgramFiles\streamapp",
  "$env:ProgramFiles\MEIDA",
  "$env:ProgramFiles\meida",
  "${env:ProgramFiles(x86)}\streamapp",
  "${env:ProgramFiles(x86)}\MEIDA",
  "${env:ProgramFiles(x86)}\meida"
)
$encontrada = $false
foreach ($c in $caminhos) {
  if (Test-Path $c) {
    $mb = 0
    try { $mb = [math]::Round((Get-ChildItem $c -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB, 1) } catch {}
    $exe = Join-Path $c "MEIDA.exe"
    if (Test-Path $exe) {
      $v = ""
      try { $v = (Get-Item $exe).VersionInfo.ProductVersion } catch {}
      Bom ("ENCONTRADA e completa: " + $exe + "   versao " + $v + "   " + $mb + " MB")
      $encontrada = $true
    } else {
      Aviso ("pasta existe mas SEM MEIDA.exe: " + $c + "   (" + $mb + " MB)")
      $n = (Get-ChildItem $c -ErrorAction SilentlyContinue | Select-Object -First 8 -ExpandProperty Name) -join ", "
      Info ("  conteudo: " + $n)
    }
  }
}
if (-not $encontrada) { Erro "MEIDA.exe nao esta em nenhuma pasta de instalacao conhecida." }

# ------------------------------------------------------- 1b. procura geral
Secao "2. PROCURAR EM TODO O SITIO (as raizes provaveis)"
foreach ($r in @("$env:LOCALAPPDATA\Programs", "$env:ProgramFiles", "${env:ProgramFiles(x86)}", "$env:APPDATA")) {
  if (-not (Test-Path $r)) { continue }
  try {
    $achou = Get-ChildItem $r -Recurse -Depth 3 -File -Filter "*.exe" -ErrorAction SilentlyContinue |
             Where-Object { $_.Name -eq "MEIDA.exe" -or $_.Name -eq "Uninstall MEIDA.exe" }
    foreach ($a in $achou) {
      Info ("  " + $a.FullName + "   (" + [math]::Round($a.Length / 1KB) + " KB)")
    }
  } catch {}
}
Info "(se nao aparecer nada acima, a app nao esta instalada em lado nenhum)"

# --------------------------------------------- 3. Painel de Control
Secao "3. O QUE O PAINEL DE CONTROL DIZ"
try {
  $achadas = @()
  foreach ($base in @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall")) {
    foreach ($k in (Get-ChildItem $base -ErrorAction SilentlyContinue)) {
      $p = Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue
      if ($p -and $p.DisplayName -and $p.DisplayName -match "MEIDA") {
        $achadas += $p
        Info ("  " + $p.DisplayName + "   versao " + $p.DisplayVersion)
        Info ("     local   : " + $p.InstallLocation)
        Info ("     desinst : " + $p.UninstallString)
        $destino = $null
        if ($p.UninstallString) {
          $destino = ($p.UninstallString -replace '^"', "" -split '"')[0]
          if ($destino -and (Test-Path $destino)) { Bom ("     o desinstalador existe: " + $destino) }
          elseif ($destino) { Erro ("     o desinstalador NAO existe: " + $destino) }
        }
      }
    }
  }
  if ($achadas.Count -eq 0) { Info "Nenhuma entrada da MEIDA no Painel de Control." }
  elseif ($achadas.Count -gt 1) { Erro ("Ha " + $achadas.Count + " entradas da MEIDA. Isso estraga a instalacao. Remove as que sobram.") }
} catch { Erro ("nao consegui ler o Painel de Control: " + $_.Exception.Message) }

# --------------------------------------------- 4. Defender: o suspecto principal
Secao "4. DEFENDER - O QUE BLOQUEIOU OU MANDOU PARA QUARENTENA"
try {
  $mp = Get-MpComputerStatus -ErrorAction Stop
  Info ("proteccao em tempo real : " + $(if ($mp.RealTimeProtectionEnabled) { "LIGADA" } else { "DESLIGADA" }))
  Info ("ultima analise          : " + $mp.QuickScanEndTime)
  Info ("assinaturas            : " + $mp.AntivirusSignatureVersion)
} catch { Info "nao consegui ler o estado do Defender." }

try {
  Info "historico de deteccoes (ultimas 24 horas):"
  $det = Get-MpThreatDetection -ErrorAction Stop | Where-Object { $_.InitialDetectionTime -gt (Get-Date).AddHours(-24) }
  if ($det) {
    foreach ($d in $det) {
      Erro ("DETECTADO: " + $d.ThreatName + "   accao: " + $d.ActionSuccess)
      Info ("   quando : " + $d.InitialDetectionTime)
      Info ("   recurso: " + $d.Resources)
    }
  } else {
    Bom "nenhuma deteccao nas ultimas 24 horas"
  }
} catch { Info "nao consegui ler o historico de deteccoes (pode exigir administrador)." }

# O log certo: o Defender regista aqui, e nao no registo de Aplicacoes.
# Os ids 5007/5010/5012 sao "a configuracao foi alterada" - acontecem o dia
# inteiro sem parar nada e tapariam o que interessa, por isso ficam de fora.
Secao "5. LOG DO DEFENDER (eventos de bloqueio/quarentena)"
try {
  $todos = Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-Windows Defender/Operational'; StartTime = (Get-Date).AddHours(-3) } `
           -MaxEvents 400 -ErrorAction Stop
  $ev = $todos | Where-Object { $_.Id -in 1116,1117,1118,1119,1121,1123,1124 }
  if ($ev) {
    foreach ($e in ($ev | Select-Object -First 12)) {
      Erro ("  " + $e.TimeCreated.ToString("HH:mm") + "  id=" + $e.Id + "  " + $e.Message.Split("`n")[0])
    }
  } else {
    Bom "o Defender NAO registou nenhuma bloqueio nem quarentena nas ultimas 3 horas"
    Info ("(eventos de 'configuracao alterada', ignorados: " + (@($todos | Where-Object { $_.Id -in 5007,5010,5012 }).Count) + ")")
  }
} catch { Info ("log do Defender indisponivel: " + $_.Exception.Message) }

# --------------------------------------------- 6. outros bloqueios
Secao "6. OUTROS MODOS DE BLOQUEIO"
# O CodeIntegrity regista tambem coisas do dia-a-dia (o browser a carregar
# drivers). So interessa se falar da MEIDA.
try {
  $ci = Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-CodeIntegrity/Operational'; StartTime = (Get-Date).AddHours(-3) } -MaxEvents 200 -ErrorAction Stop |
        Where-Object { $_.Message -match 'MEIDA|streamapp|Programs' }
  if ($ci) { foreach ($e in ($ci | Select-Object -First 6)) { Erro ("  " + $e.TimeCreated.ToString("HH:mm") + "  id=" + $e.Id + "  " + $e.Message.Split("`n")[0]) } }
  else { Bom "CodeIntegrity: nada bloqueou a MEIDA" }
} catch { Info "CodeIntegrity: sem registo" }

# O 8001 e "a politica foi aplicada" - acontece sempre e nao significa nada.
try {
  $al = Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-AppLocker/EXE and DLL'; StartTime = (Get-Date).AddHours(-3) } -MaxEvents 200 -ErrorAction Stop |
        Where-Object { $_.Id -in 8002,8003,8004,8029,8030,8031 }
  if ($al) { foreach ($e in ($al | Select-Object -First 6)) { Erro ("  " + $e.TimeCreated.ToString("HH:mm") + "  id=" + $e.Id + "  " + $e.Message.Split("`n")[0]) } }
  else { Bom "AppLocker: nada bloqueou a MEIDA" }
} catch { Info "AppLocker: sem politica ou sem registo" }

Secao "7. O INSTALADOR DESCARREGADO"
try {
  $inst = Get-ChildItem $env:TEMP -Filter "MEIDA-Setup-*.exe" -ErrorAction SilentlyContinue |
          Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($inst) {
    Info ("ficheiro : " + $inst.FullName)
    Info ("tamanho  : " + $inst.Length + " bytes")
    Info ("escrito  : " + $inst.LastWriteTime)
    $z = Get-Item $inst.FullName -Stream * -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Stream
    if ($z -contains "Zone.Identifier") {
      Aviso "o ficheiro tem 'Mark of the Web' (Veio da internet)."
      try {
        (Get-Content $inst.FullName -Stream Zone.Identifier) | ForEach-Object { Info ("    " + $_) }
      } catch {}
    } else {
      Bom "sem Mark of the Web"
    }
  } else { Info "nao ha instalador na pasta temporaria (foi apagado ou nunca chegou la)" }
} catch { Info "nao consegui ver a pasta temporaria" }

Secao "8. WINDOWS E ESPACO"
try {
  $os = Get-CimInstance Win32_OperatingSystem
  Info ("Windows " + $os.Caption + "   build " + $os.BuildNumber)
} catch {}
$d = New-Object System.IO.DriveInfo "C:"
Info ("livre em C: : " + [math]::Round($d.AvailableFreeSpace / 1MB) + " MB de " + [math]::Round($d.TotalSize / 1MB) + " MB")

Secao "VEREDITO"
if ($encontrada) {
  Bom "A app esta instalada. Arranca pelo icone do Menu Iniciar."
} else {
  Erro "A app NAO esta instalada."
  Info "Le o ponto 4 acima. Se o Defender registou algo, o problema e esse."
  Info "Se nao registou nada em lado nenhum, entao o instalador foi aceite"
  Info "e os ficheiros desapareceram sem o Windows deixar rasto - o unico"
  Info "restante e o Windows estar desactualizado (build 22000 e de 2021)."
}

Write-Output ""
Write-Output "FIM."