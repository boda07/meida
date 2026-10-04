# Reparar a instalacao da MEIDA (Windows).
#
# IMPORTANTE: este ficheiro e propositadamente SOMENTE ASCII (sem acentos).
# O PowerShell do Windows le .ps1 sem BOM como ANSI, e quando o script vem da
# internet os acentos viram "?". So ASCII = relatorio certo em qualquer PC.
#
# O que faz:
#   1. ve se ha espaco em disco
#   2. ve o estado da instalacao
#   3. apaga a pasta partida e o atalho partido
#   4. descarrega o instalador mais recente do GitHub
#   5. CONFIRMA o sha512 antes de correr (download cortado = nao instala)
#   6. corre o instalador e confirma que o MEIDA.exe ficou la
#
# Como executar:
#   iwr -useb https://raw.githubusercontent.com/boda07/meida/main/scripts/reparar-instalacao.ps1 | iex | Out-File -Encoding utf8 "$env:USERPROFILE\meida-reparar.ps1"; powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\meida-reparar.ps1"
#
# So para verificar sem instalar (util para teste):
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\reparar-instalacao.ps1 -NaoInstalar

param([switch]$NaoInstalar)

$ProgressPreference = 'SilentlyContinue'
$repo = "https://github.com/boda07/meida"
$exeNome = "MEIDA.exe"
# Pastas onde o electron-builder pode instalar. O nome da pasta vem do
# "name" do package.json (streamapp), nao do productName - por isso o mesmo
# nome aparece em varias, e ha as duas variantes: sem administrador (por
# utilizador, em %LOCALAPPDATA%) e como administrador (em Program Files).
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

# O PowerShell 5.1 devolve o .Content como array de bytes, por issoisto tem de
# ser sempre convertido para texto antes de se fazer um regex.
function Get-Texto($url) {
  $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 30
  if ($r.Content -is [byte[]]) { return [Text.Encoding]::UTF8.GetString($r.Content) }
  return [string]$r.Content
}

Secao "MEIDA - REPARAR A INSTALACAO"

# ---------------------------------------------------------------- 0. disco
Secao "1. ESPACO EM DISCO"
$unidadeTemp = (Split-Path $env:TEMP -Qualifier)
if (-not $unidadeTemp) { $unidadeTemp = "C:" }
$drive = New-Object System.IO.DriveInfo($unidadeTemp)
Info ("unidade de trabalho : " + $drive.Name)
Info ("livre agora        : " + [math]::Round($drive.AvailableFreeSpace / 1MB) + " MB")
# O instalador tem de ser descarregado E descompactado (~2x).
$minimo = 500
if ($drive.AvailableFreeSpace -lt ($minimo * 1MB)) {
  Erro ("Pouco espaco. Sao precisos pelo menos " + $minimo + " MB livres em " + $drive.Name + ".")
  Erro "Liberta espaco e volta a correr isto. Nao foi feito mais nada."
  exit 1
}
Info ("espaco suficiente (sao preciso ~" + $minimo + " MB)")

# ------------------------------------------------- 1. ver o estado actual
Secao "2. ESTADO ACTUAL DA INSTALACAO"
# Ambiente: importa saber a build, porque o Controlo de Aplicacoes Inteligente
# so existe a partir da build 22567 e nao existe em Windows Home sem WDAC.
try {
  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
  Info ("Windows : " + $os.Caption + "  build " + $os.BuildNumber)
} catch { Info "Windows : nao foi possivel ler a versao." }
$sac = "nao existe nesta build"
$k = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" -ErrorAction SilentlyContinue
if ($k -and $null -ne $k.VerifiedAndReputablePolicyState) {
  if ([int]$k.VerifiedAndReputablePolicyState -eq 1) { $sac = "LIGADO" }
  else { $sac = "desligado" }
}
Info ("Controlo de Aplicacoes Inteligente : " + $sac)
$instalada = $null
foreach ($c in $caminhos) {
  if (Test-Path $c) {
    $exe = Join-Path $c $exeNome
    if (Test-Path $exe) {
      $ver = (Get-Item $exe).VersionInfo.ProductVersion
      $mb = [math]::Round((Get-ChildItem $c -Recurse -File -ErrorAction SilentlyContinue |
        Measure-Object Length -Sum).Sum / 1MB)
      Info ("INSTALADA E COMPLETA: " + $c)
      Info ("   versao " + $ver + "   tamanho " + $mb + " MB")
      $instalada = $c
    } else {
      $mb = [math]::Round((Get-ChildItem $c -Recurse -File -ErrorAction SilentlyContinue |
        Measure-Object Length -Sum).Sum / 1MB, 1)
      Problema ("PASTA PARTIDA: " + $c + "  (" + $mb + " MB, sem " + $exeNome + ")")
      $instalada = $c
    }
  }
}
if (-not $instalada) { Info "a app nao esta instalada neste PC." }

# atalhos
$ws = New-Object -ComObject WScript.Shell
$dirs = @(
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
  "$env:USERPROFILE\Desktop",
  "$env:PUBLIC\Desktop"
)
$lnks = @()
foreach ($d in $dirs) {
  Get-ChildItem -Path $d -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "MEIDA" } |
    ForEach-Object {
      $alvo = $ws.CreateShortcut($_.FullName).TargetPath
      $bom = Test-Path $alvo
      Info ($_.FullName + "  ->  " + $alvo + "   " + $(if ($bom) { "(ok)" } else { "<<< PARTIDO" }))
      if (-not $bom) { $lnks += $_.FullName }
    }
}

# Defender: se apanhou algo, e' a causa mais provavel e o script avisa.
try {
  $det = Get-MpThreatDetection -ErrorAction SilentlyContinue |
    Where-Object { ($_.Resources -join " ") -match "MEIDA|meida" }
  if ($det) {
    Problema "O Defender detectou a MEIDA. Se foi posta em quarentena, a app desaparece assim."
    Problema "Ve em Seguranca do Windows > Protecao contra virus e ameacas > Historico."
  }
} catch { }

# ------------------------------------------------- 2. limpar o que estiver partido
$partida = [bool]$instalada -and -not (Test-Path (Join-Path $instalada $exeNome))
if ($partida -or $lnks.Count) {
  Secao "3. A LIMPAR O QUE ESTA PARTIDO"

  if ($partida) {
    Aviso ("a apagar a pasta: " + $instalada)
    try {
      Remove-Item $instalada -Recurse -Force -ErrorAction Stop
      Info "pasta apagada."
    } catch {
      Erro ("nao consegui apagar a pasta: " + $_.Exception.Message)
      Erro "Fecha a app (se estiver aberta) e volta a correr. Ou apaga a pasta a mao no Explorador."
    }

    # Ao apagar a pasta, a entrada do Painel de Control > Programas fica a
    # apontar para o Uninstall MEIDA.exe que acabamos de apagar. Se ficar, o
    # instalador novo acha que ja existe uma instalacao antiga e tenta correr
    # um desinstalador que ja nao existe - que e como a instalacao falha a meio.
    try {
      $base = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall"
      foreach ($chave in (Get-ChildItem $base -ErrorAction SilentlyContinue)) {
        $pr = Get-ItemProperty $chave.PSPath -ErrorAction SilentlyContinue
        if ($pr -and ($pr.DisplayName -match "MEIDA")) {
          Info ("a remover a entrada do Painel de Control: " + $pr.DisplayName)
          Remove-Item $chave.PSPath -Recurse -Force -ErrorAction Stop
        }
      }
    } catch { Aviso "nao consegui limpar o Painel de Control (pode exigir administrador)." }
  }

  # Atalhos partidos: apaga sempre, mesmo que a pasta principal tenha ficado intacta.
  foreach ($l in $lnks) {
    try { Remove-Item $l -Force -ErrorAction Stop; Info ("atalho apagado: " + $l) }
    catch { Aviso ("nao consegui apagar o atalho: " + $l) }
  }
}

# ------------------------------------------------- 3. descarregar e verificar
Secao "4. DESCARREGAR O INSTALADOR (com verificacao)"
try {
  $y = Get-Texto "$repo/releases/latest/download/latest.yml"
} catch {
  Erro ("nao consegui ler o latest.yml do GitHub: " + $_.Exception.Message)
  Erro "Confirma que ha ligacao a internet e volta a correr."
  exit 1
}
$versao = ([regex]::Match($y, 'version:\s*([0-9.]+)')).Groups[1].Value
$ficheiro = ([regex]::Match($y, 'path:\s*(\S+)')).Groups[1].Value
$hash = ([regex]::Match($y, 'sha512:\s*(\S+)')).Groups[1].Value
$tamanhoLido = ([regex]::Match($y, 'size:\s*(\d+)')).Groups[1].Value
$tamanho = 0
if ($tamanhoLido -match '^\d+$') { $tamanho = [int]$tamanhoLido }
Info ("versao publicada : " + $versao)
Info ("ficheiro        : " + $ficheiro)
Info ("sha512 (inicio) : " + $(if ($hash) { $hash.Substring(0, 24) + "..." } else { "(nenhum)" }))
Info ("tamanho esperado: " + $tamanho + " bytes")
if (-not $ficheiro -or -not $hash -or $tamanho -le 0) {
  Erro "o latest.yml do GitHub esta inesperado. Abortado sem tocar em nada."
  exit 1
}

$destino = Join-Path $env:TEMP $ficheiro
Info ("a descarregar para " + $destino + "  (" + [math]::Round($tamanho / 1MB) + " MB)")
Info "pode demorar alguns minutos, consoorte a ligacao. Nao feches a janela."
try {
  Invoke-WebRequest "$repo/releases/latest/download/$ficheiro" -OutFile $destino -UseBasicParsing -TimeoutSec 900
} catch {
  Erro ("o download falhou: " + $_.Exception.Message)
  Erro "Nada foi instalado. Tenta outra vez com melhor ligacao."
  exit 1
}

Secao "5. VERIFICAR O FICHEIRO"
$bytes = (Get-Item $destino).Length
Info ("tamanho no disco : " + $bytes + " bytes  (esperado " + $tamanho + ")")
if ($bytes -ne $tamanho) {
  Erro "O FICHEIRO ESTA INCOMPLETO - o download foi cortado a meio."
  Erro "Nada foi instalado (e melhor: e assim que nao se estraga a app)."
  Erro "Volta a correr isto; se repetir, o problema e a ligacao a internet."
  Remove-Item $destino -Force -ErrorAction SilentlyContinue
  exit 1
}
# O sha512 do latest.yml e em BASE64, por isso nao se pode comparar com o
# Get-FileHash (que devolve hexadecimal). Calculamos o SHA-512 e codificamos.
$sha = [System.Security.Cryptography.SHA512]::Create()
$stream = [System.IO.File]::OpenRead($destino)
$calc = [Convert]::ToBase64String($sha.ComputeHash($stream))
$stream.Close()
$sha.Dispose()
if ($calc -cne $hash) {
  Erro "O FICHEIRO ESTA CORROMPIDO (o sha512 nao bate certo)."
  Erro ("  esperado: " + $hash.Substring(0, 24) + "...")
  Erro ("  obtido  : " + $calc.Substring(0, 24) + "...")
  Erro "Nada foi instalado. Volta a correr isto."
  Remove-Item $destino -Force -ErrorAction SilentlyContinue
  exit 1
}
Info "sha512 confirmado. O ficheiro esta bom."

# ------------------------------------------------- 4. instalar
if ($NaoInstalar) {
  Secao "6. OK"
  Info "(-NaoInstalar foi usado, por isso o instalador NAO foi corrido)"
  Info "Para instalar mesmo, corre o comando sem essa opcao."
  exit 0
}

Secao "6. INSTALAR"
Aviso "Vai aparecer o instalador. Deixa-o terminar; nao o canceles."
try {
  Start-Process -FilePath $destino -Wait -ErrorAction Stop
  Info "o instalador terminou."
} catch {
  Erro ("o instalador deu erro: " + $_.Exception.Message)
  Erro "Se aparecer o aviso azul do Windows, clica em Mais informacoes > Executar mesmo assim."
  Erro "Se abrir uma janela de administrador e nao aceitar, clica em Executar como administrador."
  exit 1
}

# ------------------------------------------------- 5. confirmar
Secao "7. CONFIRMAR"
$ficou = $false
foreach ($c in $caminhos) {
  if (Test-Path (Join-Path $c $exeNome)) {
    $ficou = $true
    $ver = (Get-Item (Join-Path $c $exeNome)).VersionInfo.ProductVersion
    Info ("OK: " + (Join-Path $c $exeNome) + "   versao " + $ver)
  }
}

Secao "VEREDITO"
if ($ficou) {
  Info "A MEIDA esta instalada e completa."
  Info "Abre a app pelo icone do Menu Iniciar."
  Remove-Item $destino -Force -ErrorAction SilentlyContinue
} else {
  Problema "O instalador acabou mas o MEIDA.exe continua a nao estar la."
  Problema "Guarda este relatorio: e a prova de que o instalador correu e falhou a meio."
  Problema "Porque? O registo do Windows responde:"
  try {
    $crash = Get-WinEvent -FilterHashtable @{ LogName = 'Application'; StartTime = (Get-Date).AddMinutes(-45) } `
             -MaxEvents 120 -ErrorAction Stop |
             Where-Object { $_.Message -match 'MEIDA|Setup|nsis|Uninstall' }
    if ($crash) {
      Problema "O registo do Windows registou isto:"
      $crash | Select-Object -First 4 | ForEach-Object {
        Info ("  " + $_.TimeCreated.ToString("yyyy-MM-dd HH:mm") + "  " + $_.ProviderName + "  id=" + $_.Id)
        Info ("     " + ((($_.Message -split "`r?`n") | Where-Object { $_.Trim() } | Select-Object -First 2) -join " | "))
      }
    } else {
      Info "O registo do Windows nao mostra nenhuma falha do instalador."
      Info "Se o espaco estava certo e o sha512 bateu certo, a causa mais provavel e"
      Info "o Windows estar demasiado antigo - atualiza-o (Definicoes > Windows Update)."
    }
  } catch {
    Info "Nao foi possivel ler o registo do Windows (pode exigir administrador)."
  }
  Problema "Confirma tambem que so ha uma entrada da MEIDA no Painel de Control >"
  Problema "Programas, e desinstala-a se houver mais do que uma."
  Info ("O instalador ficou guardado em: " + $destino)
}

Write-Output ""
Write-Output "FIM."
