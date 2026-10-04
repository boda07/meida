# Reparar a instalacao da MEIDA (Windows).
#
# IMPORTANTE: este ficheiro e propositadamente SOMENTE ASCII (sem acentos).
# O PowerShell do Windows le .ps1 sem BOM como ANSI, e quando o script vem da
# internet os acentos viram "?". So ASCII = relatorio certo em qualquer PC.
#
# O que faz:
#   1. ve se ha espaco em disco
#   2. ve o estado da instalacao e o tipo de processador deste PC
#   3. apaga a pasta partida, o atalho partido e a entrada do Painel de Control
#   4. descarrega o instalador mais recente do GitHub
#   5. CONFIRMA o sha512 antes de correr (download cortado = nao instala)
#   6. corre o instalador e confirma que o MEIDA.exe ficou la
#   7. confirma que o MEIDA.exe instalado e do tipo certo (x64 ou ARM64)
#
# O passo 7 e novo. As versoes 1.2.0 a 1.2.2 vieram com um instalador feito so
# para ARM64, que em PC normal nao extraia ficheiro nenhum e acabava com codigo
# 0. Dizer o tipo do processador e o do executable instalado da para ver isso de
# relance.
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

# Le o tipo de arquitectura de um executavel a partir do cabecalho PE.
# E o unico jeito de confirmar, sem instalar, que o MEIDA.exe e do tipo certo -
# foi exactamente o que falhou nas versoes 1.2.0 a 1.2.2, que vinham com um
# executavel ARM64 num instalador destinado a toda a gente.
function Get-TipoExe($caminho) {
  try {
    $fs = [System.IO.File]::OpenRead($caminho)
    $br = New-Object System.IO.BinaryReader($fs)
    $br.ReadBytes(2) | Out-Null
    $fs.Seek(0x3C, [System.IO.SeekOrigin]::Begin) | Out-Null
    $pe = $br.ReadInt32()
    $fs.Seek($pe + 4, [System.IO.SeekOrigin]::Begin) | Out-Null
    $m = $br.ReadUInt16()
    $br.Close(); $fs.Close()
    if ($m -eq 0x8664) { return "x64" }
    if ($m -eq 0xAA64) { return "ARM64" }
    if ($m -eq 0x014C) { return "x86" }
    if ($m -eq 0x01C4) { return "ARM" }
    return ("desconhecido (0x" + $m.ToString("X") + ")")
  } catch { return "nao foi possivel ler" }
}

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
# O instalador tem de ser descarregado E descompactado (~2x). O instalador
# tem dentro as duas arquitecturas (x64 e ARM64), por isso e grande: ~210 MB
# o ficheiro e ~700 MB depois de descompactado. Da a margem.
$minimo = 1000
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

# O tipo de processador deste PC. Importa porque o instalador tem de trazer a
# versao certa: um instalador so com ARM64 (como o das 1.2.0 a 1.2.2) nao extrai
# nada num PC x64 e acaba com codigo 0, sem decir nada.
# Numa maquina ARM com emulacao x64, o PROCESSOR_ARCHITECTURE diz "AMD64" que
# e MENTIRA - e era por ai que se escondia o erro. O que nao mente e o
# PROCESSOR_IDENTIFIER, que vem do processador de verdade.
$ident = $env:PROCESSOR_IDENTIFIER
$armPC = ($ident -match "ARM")
if ($armPC) { $processador = "ARM64" }
elseif ($env:PROCESSOR_ARCHITECTURE) { $processador = $env:PROCESSOR_ARCHITECTURE }
else { $processador = "desconhecido" }
Info ("processador       : " + $processador + $(if ($armPC) { "  (emulacao x64 activada, mas o CPU e ARM)" } else { "" }))
if ($ident) { Info ("identificador     : " + $ident) }
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
Aviso "Vai aparecer o instalador. Deixa-o terminar; NAO feches a janela."

# O instalador cria um atalho no ambiente de trabalho. Se essa pasta nao
# existir (o OneDrive pode move-la), o atalho nao se cria. Nao era a causa do
# que se viu - a pasta existia - mas criar a pasta e barato e evita que a
# instalacao fique a meio, por isso fica.
try {
  $desk = [Environment]::GetFolderPath("Desktop")
  if (-not (Test-Path $desk)) {
    Aviso ("a pasta do ambiente de trabalho nao existe: " + $desk)
    New-Item -ItemType Directory -Path $desk -Force -ErrorAction Stop | Out-Null
    Info "pasta criada."
  } else {
    Info ("ambiente de trabalho : " + $desk + "  (existe, ok)")
  }
} catch {
  Erro ("nao consegui criar a pasta do ambiente de trabalho: " + $_.Exception.Message)
}

# Se a app estiver a correr, o instalador recusa-se a instalar. Vale a pena
# dizer, porque o erro que aparece nao explica nada.
try {
  $aCorrer = @(Get-Process -Name "MEIDA" -ErrorAction SilentlyContinue)
  if ($aCorrer.Count) {
    Erro "A MEIDA esta aberta neste momento. O instalador nao a vai substituir."
    Erro "Fecha a app (e o icone ao lado do relogio) e volta a correr isto."
    exit 1
  }
} catch {}

# O CODIGO DE SAIDA e a informacao mais importante de todas. O NSIS usa:
#   0 = sucesso   1 = cancelado   2 = erro grave na instalacao
# A versao anterior deste script deitava este codigo fora, e sem ele nao se
# sabe se o instalador chegou a fazer alguma coisa.
$codigo = $null
try {
  $proc = Start-Process -FilePath $destino -Wait -PassThru -ErrorAction Stop
  $codigo = $proc.ExitCode
  Info ("o instalador terminou. codigo de saida: " + $codigo)
} catch {
  Erro ("o instalador deu erro: " + $_.Exception.Message)
  Erro "Se aparecer o aviso azul do Windows, clica em Mais informacoes > Executar mesmo assim."
  Erro "Se abrir uma janela de administrador e nao aceitar, clica em Executar como administrador."
  exit 1
}
if ($codigo -eq 1) {
  Erro "O INSTALADOR FOI CANCELADO."
  Erro "Isto explica o que se viu: cancelado, o Windows desfaz mas deixa o"
  Erro "Uninstall MEIDA.exe e a entrada no Painel de Control, sem a app."
  Erro "Corre outra vez e espera que a barra de progresso chegue ao fim."
} elseif ($codigo -eq 2) {
  Erro "O instalador deu um erro grave (codigo 2) e desistiu."
  Erro "Causas correntes: a app estava aberta, ou ja ha outra versao instalada."
} elseif ($codigo -ne 0 -and $null -ne $codigo) {
  Erro ("o instalador devolveu o codigo " + $codigo + " (que nao e sucesso).")
}

# ------------------------------------------------- 5. confirmar
Secao "7. CONFIRMAR"
$ficou = $false
$tipoErrado = $null
foreach ($c in $caminhos) {
  $exeC = Join-Path $c $exeNome
  if (Test-Path $exeC) {
    $ficou = $true
    $ver = (Get-Item $exeC).VersionInfo.ProductVersion
    Info ("OK: " + $exeC + "   versao " + $ver)
    $tipo = Get-TipoExe $exeC
    Info ("   tipo do executavel: " + $tipo + "   (este PC e " + $processador + ")")
    # Num PC normal tem de ser x64; num PC ARM tem de ser ARM64. Um executavel
    # do tipo errado nao arranca - e e assim que se descobre o erro cedo.
    if ($armPC -and $tipo -ne "ARM64") { $tipoErrado = $tipo }
    if ((-not $armPC) -and $tipo -ne "x64") { $tipoErrado = $tipo }
  }
}

Secao "VEREDITO"
if ($tipoErrado) {
  Problema ("A MEIDA esta instalada, mas o executavel e do tipo ERRADO (" + $tipoErrado + ")")
  Problema ("Este PC e " + $processador + ". O ficheiro instalado e de outro tipo,")
  Problema "por isso a app nao vai arrancar. Nao foi o teu PC que fez nada de errado."
  Problema "Desinstala-a no Painel de Control > Programas e corre isto outra vez."
  Problema "Se acontecer outra vez, diz a quem te deu o script: e um erro nosso."
} elseif ($ficou) {
  Info "A MEIDA esta instalada, completa, e do tipo certo para este PC."
  Info "Abre a app pelo icone do Menu Iniciar."
  Remove-Item $destino -Force -ErrorAction SilentlyContinue
} else {
  Problema "O instalador acabou mas o MEIDA.exe continua a nao estar la."
  if ($null -ne $codigo) {
    if ($codigo -eq 0) {
      Problema "O instalador devolveu 0, ou seja, ELE ACHA QUE CORREU BEM."
      Problema "Foi assim que o problema passou despercebido ate hoje: o Windows"
      Problema "aceitou o instalador, criou o atalho e o Painel de Control, e"
      Problema "nao pos a app. Nao foi nada do teu PC."
    } else {
      Problema ("O instalador devolveu o codigo " + $codigo + " - ou seja, NAO foi bem-sucedido.")
    }
  }
  Problema "Guarda este relatorio e manda-o a quem te deu o script."
  Problema ("Vai tambem ao Painel de Control > Programas: se a MEIDA " + $versao + " la")
  Problema "estiver, o instalador criou a entrada mas nao extraiu a app - nesse"
  Problema "caso desinstala-a e corre isto outra vez."
  Problema "Porque? Estes sao os registos que respondem:"
  try {
    $crash = Get-WinEvent -FilterHashtable @{ LogName = 'Application'; StartTime = (Get-Date).AddMinutes(-45) } `
             -MaxEvents 120 -ErrorAction Stop |
             Where-Object { $_.Message -match 'MEIDA|Setup|nsis|Uninstall' }
    if ($crash) {
      Problema "O registo de Aplicacoes registou isto:"
      $crash | Select-Object -First 4 | ForEach-Object {
        Info ("  " + $_.TimeCreated.ToString("HH:mm") + "  " + $_.ProviderName + "  id=" + $_.Id)
        Info ("     " + ((($_.Message -split "`r?`n") | Where-Object { $_.Trim() } | Select-Object -First 2) -join " | "))
      }
    } else { Info "registo de Aplicacoes: nada." }
  } catch { Info "Nao foi possivel ler o registo de Aplicacoes." }

  # O registo de Aplicacoes nunca regista ficheiros bloqueados. Esse registo
  # e o CodeIntegrity, e e o unico que serve quando o Windows recusa um
  # executavel sem assinatura.
  try {
    $ci = Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-CodeIntegrity/Operational'; StartTime = (Get-Date).AddMinutes(-45) } `
           -MaxEvents 200 -ErrorAction Stop |
           Where-Object { $_.Message -match 'MEIDA|streamapp' }
    if ($ci) {
      Problema "O CodeIntegrity BLOQUEOU alguma coisa:"
      $ci | Select-Object -First 4 | ForEach-Object {
        Info ("  " + $_.TimeCreated.ToString("HH:mm") + "  id=" + $_.Id)
        Info ("     " + ($_.Message.Split("`n")[0]))
      }
    } else { Info "CodeIntegrity: nada bloqueou a MEIDA." }
  } catch { Info "CodeIntegrity: sem registo." }

  try {
    $det = Get-MpThreatDetection -ErrorAction Stop | Where-Object { $_.InitialDetectionTime -gt (Get-Date).AddHours(-3) }
    if ($det) {
      Problema "O Defender DETECTOU alguma coisa:"
      $det | Select-Object -First 3 | ForEach-Object {
        Info ("  " + $_.InitialDetectionTime + "  " + $_.ThreatName)
        Info ("     " + $_.Resources)
      }
    } else { Info "Defender: nenhuma deteccao nas ultimas 3 horas." }
  } catch { Info "Defender: nao consegui ler o historico." }
  Info ("O instalador ficou guardado em: " + $destino)
}

Write-Output ""
Write-Output "FIM."
