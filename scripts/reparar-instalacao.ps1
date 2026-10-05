# Reparar a instalacao da MEIDA (Windows).
#
# IMPORTANTE: este ficheiro e propositadamente SOMENTE ASCII (sem acentos).
# O PowerShell do Windows le .ps1 sem BOM como ANSI, e quando o script vem da
# internet os acentos viram "?". So ASCII = relatorio certo em qualquer PC.
#
# O que faz (tudo sozinho, sem passos previos):
#   1. ve se ha espaco em disco
#   2. ve o estado da instalacao e o tipo de processador deste PC
#   3. apaga a pasta partida, o atalho partido e a entrada do Painel de Control
#   4. descarrega o instalador e a zip da versao mais recente, e CONFIRMA os
#      dois (tamanho e sha512) antes de usar
#   5. corre o instalador
#   6. repoe os ficheiros que o instalador nao copiou, a partir da zip
#   7. apaga o cache da app (e' o que prendia as novidades numa versao antiga)
#   8. refaz os atalhos e confirma que o MEIDA.exe e do tipo certo
#
# Porque a zip: o instalador do electron-builder NAO copia os .exe nem as .dll
# e sai com codigo 0 a dizer que correu bem. A zip traz a app inteira sem
# passar pelo NSIS, por isso e' ela que deixa a instalacao completa.
#
# Como executar (uma linha, nao precisa de mais nada):
#   iwr -useb https://gist.githubusercontent.com/boda07/a1c36acc2f3c3fd5a4a064b8d87c97e5/raw -OutFile "$env:USERPROFILE\meida-reparar.ps1"; powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\meida-reparar.ps1" | Out-File -Encoding utf8 "$env:USERPROFILE\meida-reparar.txt"; notepad "$env:USERPROFILE\meida-reparar.txt"
#
# So para verificar sem instalar (util para teste):
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\reparar-instalacao.ps1 -NaoInstalar
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

# ------------------------------------------------- 4b. a zip que repoe os ficheiros
# O instalador NAO COPIA os .exe e as .dll (bug do electron-builder/NSIS), e
# tambem nao repoe ficheiros que ja existiam de uma instalacao antiga. A zip
# traz a app inteira sem passar pelo NSIS, por isso e ela que se usa para deixar
# a instalacao completa e da versao certa.
#
# Descarga-se sozinha, da mesma release, com o nome certo para este PC. Nao ha
# passo nenhum para a pessoa fazer.
Secao "5b. A COPIA DA APP (descarregada automaticamente)"
$sufixoZip = if ($armPC) { "-arm64-win.zip" } else { "-win.zip" }
$zipNome = "MEIDA-$versao$sufixoZip"
$zipPath = Join-Path $env:TEMP $zipNome
$zipURL = "$repo/releases/download/v$versao/$zipNome"
Info ("zip necessaria : " + $zipNome)
if (Test-Path $zipPath) {
  $jz = (Get-Item $zipPath).Length
  Info ("ja existe na pasta temporaria (" + [math]::Round($jz/1MB) + " MB) - vai ser reaproveitada")
} else {
  Info ("a descarregar de " + $zipURL)
  Info "Pode demorar alguns minutos, consoorte a ligacao. Nao feches a janela."
  try {
    Invoke-WebRequest $zipURL -OutFile $zipPath -UseBasicParsing -TimeoutSec 1800
    Info ("descarregada: " + [math]::Round((Get-Item $zipPath).Length/1MB) + " MB")
  } catch {
    Problema ("nao consegui descarregar a zip: " + $_.Exception.Message)
    Problema "Sem a zip a app fica sem o MEIDA.exe e nao abre. Tenta outra vez."
    Problema "Se isto repetir, a ligacao pode estar a cortar. Ou descarrega a mao"
    Problema ("de " + $zipURL)
    Problema ("e mete-a em " + $env:TEMP + ", depois corre isto outra vez.")
    exit 1
  }
}
# Confirma que a zip tem o MEIDA.exe (e que e do tipo certo).
try {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $z = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  $e = $z.Entries | Where-Object { $_.FullName -eq $exeNome } | Select-Object -First 1
  $z.Dispose()
  if (-not $e) { Erro "a zip nao tem o MEIDA.exe dentro. Algo correu mal no download."; exit 1 }
  Info ("a zip tem o " + $exeNome + " (" + [math]::Round($e.Length/1MB,1) + " MB)")
} catch {
  Erro ("a zip parece estar corrompida: " + $_.Exception.Message)
  Erro "Apaga-a e corre isto outra vez."
  Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
  exit 1
}

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

# Se a app estiver a correr, o instalador recusa-se a instalar. Em vez de
# desistir e obrigar a pessoa a tentar outra vez, fecha-se a app: e o que
# estraga o script e' deixar a app aberta (bloqueia a limpeza do cache, que e'
# o que da o "fail to fetch" e a tela preta).
try {
  $aCorrer = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
    ($_.ProcessName -match "MEIDA") -and ($_.Path -notlike "*Uninstall*") -and ($_.HasExited -eq $false)
  })
  if ($aCorrer.Count) {
    Info ("a app esta aberta (" + $aCorrer.Count + " processos). Vou fecha-la.")
    foreach ($pp in $aCorrer) { try { $pp.CloseMainWindow() | Out-Null } catch {} }
    Start-Sleep -Seconds 4
    $aCorrer = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
      ($_.ProcessName -match "MEIDA") -and ($_.Path -notlike "*Uninstall*") -and ($_.HasExited -eq $false)
    })
    if ($aCorrer.Count) {
      foreach ($pp in $aCorrer) { try { $pp.Kill() } catch {} }
      Start-Sleep -Seconds 3
      $sobram = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
        ($_.ProcessName -match "MEIDA") -and ($_.Path -notlike "*Uninstall*") -and ($_.HasExited -eq $false)
      })
      if ($sobram.Count) {
        Erro "Nao consegui fechar a MEIDA. Fecha a janela e o icone ao lado do"
        Erro "relogio, e corre este script outra vez."
        exit 1
      }
      Info "app fechada."
    } else {
      Info "app fechada."
    }
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
  # -Wait so espera pelo processo que lancamos. O instalador lanca outros
  # (um que cria os atalhos, outro que extrai) e esses continuam a correr
  # segundos depois. Se comecarmos a repor ficheiros enquanto eles trabalham,
  # eles podem sobrescrever o que pusemos - e foi assim que os atalhos ficaram
  # a apontar para um MEIDA.exe que nao existia ainda.
  for ($i = 0; $i -lt 30; $i++) {
    $sobram = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
      ($_.ProcessName -match "MEIDA") -and ($_.Path -notlike "*Uninstall*")
    })
    if ($sobram.Count -eq 0) { break }
    Start-Sleep -Seconds 1
  }
  $sobram = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
    ($_.ProcessName -match "MEIDA") -and ($_.Path -notlike "*Uninstall*")
  })
  if ($sobram.Count -eq 0) { Info "o instalador fechou todos os processos." }
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

# ------------------------------------------------- 4b. ficheiros em falta
# O INSTALADOR NAO COPIA OS .exe E AS .dll. Confirmado em varias maquinas e
# varias versoes: o electron-builder poe no pacote tudo, mas o comando
# CopyFiles do NSIS que copia para a pasta de destino ignora os executaveis e
# as bibliotecas - e nao da erro nenhum, o instalador acaba com codigo 0 a dizer
# que correu bem. Ficam 7 ficheiros em falta, o MEIDA.exe entre eles (216 MB).
# Tambem nao repoe ficheiros que ja existiam de uma instalacao antiga (o
# app.asar e o web/dist), pelo que a app abria com a versao antiga da interface.
#
# Nao e problema do PC: o Windows copia estes ficheiros sem dificuldade. E o
# script faz essa copia, que e o que o instalador devia fazer. A zip traz a app
# inteira sem passar pelo NSIS, por isso e ela que deixa tudo certo.
Secao "6b. FICHEIROS EM FALTA (o instalador esqueceu-se destes)"

# Onde esta a app. Depois de instalar ja tem de existir; se nao existir, o
# instalador falhou mesmo e nao ha nada para repor.
$instalada2 = $null
foreach ($c in $caminhos) {
  if (Test-Path $c) {
    $n = @(Get-ChildItem $c -File -ErrorAction SilentlyContinue)
    if ($n.Count -gt 0) { $instalada2 = $c; break }
  }
}
if (-not $instalada2) {
  Problema "A pasta da app nao existe depois de instalar. O instalador falhou."
  Problema "Volta a correr este script; se repetir, a instalacao nao e possivel."
}

if ($instalada2) {
# Fecha a app ANTES de mexer nos ficheiros. O instalador, no fim, lanca a app
# (autoLaunch) - se ela estiver a correr quando vamos repor a pasta, tranca
# os ficheiros e a copia falha a meio.
$vivos = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
  ($_.ProcessName -match "MEIDA") -and ($_.Path -notlike "*Uninstall*") -and ($_.HasExited -eq $false)
})
if ($vivos.Count -gt 0) {
  Info ("a app foi aberta pelo instalador (" + $vivos.Count + " processos). Vou fecha-la.")
  foreach ($pv in $vivos) { try { $pv.Kill() } catch {} }
  Start-Sleep -Seconds 4
}

$zip = if (Test-Path $zipPath) { Get-Item $zipPath } else { $null }
if (-not $zip) {
  Problema "A zip desapareceu. Corre este script outra vez que ele volta a descarrega-la."
} else {
  Info ("a usar: " + $zip.Name + "  (" + [math]::Round($zip.Length/1MB) + " MB)")
  $payload = Join-Path $env:TEMP 'meida-payload'
  try {
    Remove-Item $payload -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $payload -Force | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zip.FullName, $payload)
    Info "zip descompactada."
  } catch {
    Erro ("nao consegui abrir a zip: " + $_.Exception.Message)
  }

  # Copia a zip inteira por cima da instalacao.
  try {
    Info "a repor a app inteira (pode demorar um minuto)..."
    $copiados = 0
    Get-ChildItem $payload -Recurse -File | ForEach-Object {
      $rel = $_.FullName.Substring($payload.Length + 1)
      $dest = Join-Path $instalada2 $rel
      $dir = Split-Path $dest -Parent
      if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force -ErrorAction SilentlyContinue | Out-Null }
      Copy-Item $_.FullName $dest -Force -ErrorAction SilentlyContinue
      $copiados++
    }
    Info ("ficheiros repostos: " + $copiados)
  } catch {
    Erro ("falhou repor a app: " + $_.Exception.Message)
  }
  Remove-Item $payload -Recurse -Force -ErrorAction SilentlyContinue
}

# Confirma os 7 ficheiros criticos.
$faltamFinal = @()
if ($instalada2) {
  foreach ($f in $extras) {
    if (Test-Path (Join-Path $instalada2 $f)) { Info ('  ok: ' + $f) }
    else { Problema ('  continua em falta: ' + $f); $faltamFinal += $f }
  }
} else {
  $faltamFinal = @($exeNome)
}

# Refaz os atalhos. O instalador cria-os antes de repor o MEIDA.exe, por isso
# ficam a apontar para um ficheiro que ainda nao existe; o Windows marca-os
# como invalidos e depois pergunta se se quer corrigir - e a pessoa tem de
# carregar em 'Corrigir' a mao.
$exeFinal = if ($instalada2) { Join-Path $instalada2 $exeNome } else { $null }
if ($exeFinal -and (Test-Path $exeFinal) -and ($faltamFinal.Count -eq 0)) {
  try {
    $shell = New-Object -ComObject WScript.Shell
    $destinos = @(
      (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"),
      (Join-Path $env:PUBLIC "Desktop"),
      [Environment]::GetFolderPath("Desktop")
    )
    foreach ($d in $destinos) {
      if (-not (Test-Path $d)) { continue }
      $lnk = Join-Path $d "MEIDA.lnk"
      $sc = $shell.CreateShortcut($lnk)
      $sc.TargetPath = $exeFinal
      $sc.IconLocation = "$exeFinal,0"
      $sc.Description = "MEIDA"
      $sc.Save()
    }
    Info "atalhos refeitos (ja nao precisam de correccao)."
  } catch {
    Aviso ("nao consegui refazer os atalhos: " + $_.Exception.Message)
  }
}
}

# O cache da interface. O Electron guarda no perfil o index.html e os
# ficheiros JS que descarregou. Depois de uma instalacao nova esse cache e'
# de uma versao antiga: a app abre com a lista de novidades presa, da'
# 'fail to fetch' (o bundle velho pede ficheiros que ja nao existem) e a
# janela fica preta. Apagar o cache resolve, e nao toca em nada do
# utilizador: so se apaga o cache de ficheiros, que se re-descarrega do
# servidor local. As listas, notas e sessao estao noutro sitio (IndexedDB,
# localStorage) e ficam intactas.
#
# O nome da pasta do perfil vem do 'name' do package.json (streamapp), nao do
# productName - por isso e' 'streamapp' e nao 'MEIDA'.
$perfis = @((Join-Path $env:APPDATA 'streamapp'), (Join-Path $env:APPDATA 'meida'), (Join-Path $env:APPDATA 'MEIDA'))
$cacheFalhou = $false
foreach ($perf in $perfis) {
  if (-not (Test-Path $perf)) { continue }
  $caches = @(Get-ChildItem $perf -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -in @('Cache', 'Code Cache', 'GPUCache') -or $_.Name -like 'Service Worker*' })
  foreach ($c in $caches) {
    $ok = $false
    # Varias tentativas: o Windows por vezes demora a largar o ficheiro
    # depois de a app fechar.
    for ($t = 0; $t -lt 4 -and -not $ok; $t++) {
      try {
        Remove-Item $c.FullName -Recurse -Force -ErrorAction Stop
        $ok = $true
      } catch {
        Start-Sleep -Seconds 2
      }
    }
    if ($ok) {
      Info ("cache apagado: " + $c.Name)
    } else {
      Problema ("NAO consegui apagar o cache " + $c.Name)
      Problema "E por isso que a app vai continuar a dar fetch."
      Problema "Fecha a MEIDA, espera uns segundos, e corre isto outra vez."
      $cacheFalhou = $true
    }
  }
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
  Problema "Isto acontece quando a zip de onde se copiam os ficheiros e de outra"
  Problema "arquitectura. Apaga a MEIDA no Painel de Control > Programas, e"
  Problema "descarrega a zip certa antes de correr isto outra vez."
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
