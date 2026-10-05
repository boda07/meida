# =============================================================================
# MEIDA - VERIFICAR NUM PC x86 (Intel/AMD normal)
# =============================================================================
#
# Este script NAO instala nada. So olha e testa.
#
# Serve para confirmar que o bug do programa nativo (que nao abria em nenhum
# PC x86) esta mesmo resolvido, e para dizer exactamente o que falha se nao
# estiver.
#
# Como usar: cola a linha de comando abaixo numa janela do PowerShell.
#
# -----------------------------------------------------------------------------

$Erro = 0
$Aviso = 0

# As tres funcoes de mensagem juntam todas as palavras que lhes sao passadas.
#
# Antes recebiam um unico [string]$m, e isso era uma armadilha: numa chamada como
#   OK "a versao e' " + $Versao
# o PowerShell NAO concatena - passa tres argumentos ("a versao e' ", "+",
# $Versao) e a funcao, que so via o primeiro, imprimia a frase sem a versao. O
# mesmo acontecia com `Write-Host "porta " + $Porta + "..."`, que saia
# "porta  + 5175 + ...". Ou seja: as mensagens que dizem porque algo correu mal
# perdiam justamente a parte importante. Por isso agora, se sobrar mais de um
# argumento, e' aviso de que falta um parenteses na chamada.
function JuntarMensagem($Argumentos) {
  if ($Argumentos.Count -gt 1) {
    Write-Host "  [ ? ]atencao: mensagem chamada com varios argumentos (falta um parenteses)"
    $script:Aviso++
  }
  return ($Argumentos -join " ")
}

function OK   { Write-Host ("  [ OK ] " + (JuntarMensagem $args)) }
function Mal  { Write-Host ("  [FALHA] " + (JuntarMensagem $args)) -ForegroundColor Red;  $script:Erro++ }
function Duv  { Write-Host ("  [ ? ] " + (JuntarMensagem $args)) -ForegroundColor Yellow; $script:Aviso++ }
function Cab  ([string]$m) { Write-Host ""; Write-Host ("== " + $m + " " + ("=" * [Math]::Max(0, 58 - $m.Length))) -ForegroundColor Cyan }

# Le o cabecalho PE de um ficheiro e devolve "x64", "ARM64", "x86" ou "?" (ou
# $null se o ficheiro for demasiado pequeno / nao for um executavel).
function TipoDe([string]$Caminho) {
  try {
    $F = [System.IO.File]::ReadAllBytes($Caminho)
    if ($F.Length -lt 0x40) { return $null }
    $Pos = [System.BitConverter]::ToInt32($F, 0x3c)
    if ($Pos -lt 0 -or ($Pos + 6) -gt $F.Length) { return $null }
    $Maquina = [System.BitConverter]::ToUInt16($F, $Pos + 4)
    switch ($Maquina) {
      0x8664 { return "x64" }
      0xaa64 { return "ARM64" }
      0x14c  { return "x86" }
      default { return "?" }
    }
  } catch { return $null }
}

# Corre um trecho de codigo no Node que esta dentro da app, e devolve so a
# linha que traz a marca pedida.
#
# Quatro cuidados, todos aprendidos a errar:
#  1. O codigo vai para um ficheiro .js, nunca para o -e: o PowerShell mete
#     aspas no -e e o Node deixa de o ver direito.
#  2. O corpo e' montado fora e passado como um so argumento. Se se passar
#     'texto' + $variavel directamente na chamada, o PowerShell come o resto
#     dos argumentos e o ficheiro fica truncado.
#  3. Passa por cmd.exe: o MEIDA.exe e' um executavel GUI (Electron) e um GUI
#     nao escreve no stdout do PowerShell - o 1> fica vazio. O cmd redirecciona.
#  4. Nao se usa 2>&1 no PowerShell: isso transforma o texto do Node num
#     ErrorRecord e aparece "MEIDA.exe : C:\...js:1" em vez da mensagem.
function TestarNode([string]$Exe, [string]$Marca, [string]$Corpo, [string]$Extensao) {
  if (-not $Extensao) { $Extensao = ".cjs" }
  $Js = Join-Path $env:TEMP ("meida-teste-" + $Marca + $Extensao)
  $Saida = Join-Path $env:TEMP ("meida-teste-" + $Marca + ".out")

  $Codigo = "try{" + $Corpo + "}catch(e){console.log('" + $Marca + "=ERRO:'+e.message)}" + "`n"
  Set-Content -Path $Js -Value $Codigo -Encoding ASCII

  Remove-Item $Saida -Force -ErrorAction SilentlyContinue
  $Cmd = 'set ELECTRON_RUN_AS_NODE=1&& "' + $Exe + '" "' + $Js + '" > "' + $Saida + '" 2>&1'
  $Env:ELECTRON_RUN_AS_NODE = "1"

  # Start-Process em vez de &: e' preciso para poder matar o processo se ele
  # ficar preso. O -Wait espera sem limite, por isso espera-se aqui em
  # tentativas curtas e mata-se a seguir se nao houver resultado.
  $P = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $Cmd -PassThru -NoNewWindow
  $Esperado = 30
  $Seg = 0
  while ($Seg -lt $Esperado) {
    Start-Sleep -Seconds 1
    $Seg++
    if (Test-Path $Saida) {
      $Tmp = Get-Content $Saida -Raw -ErrorAction SilentlyContinue
      if ($Tmp -and ($Tmp -like ("*" + $Marca + "*"))) { break }
    }
    if ($P.HasExited) { break }
  }
  if (-not $P.HasExited) { Stop-Process -Id $P.Id -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 300

  $Texto = ""
  if (Test-Path $Saida) { $Texto = Get-Content $Saida -Raw -ErrorAction SilentlyContinue }
  Remove-Item $Js, $Saida -Force -ErrorAction SilentlyContinue

  foreach ($L in ($Texto -split "`n")) {
    if ($L -like ("*" + $Marca + "*")) { return $L.Trim() }
  }
  return ""
}

# ------------------------------------------------------------------ 1. O PC
Cab "1. ESTE PC"

$Processador = (Get-CimInstance Win32_Processor).Architecture
$Modelo = (Get-CimInstance Win32_Processor).Name
Write-Host ("  processador : " + $Modelo)
Write-Host ("  windows     : " + (Get-CimInstance Win32_OperatingSystem).Caption)

if ([Environment]::Is64BitOperatingSystem) {
  Write-Host ("  e' um PC de 64 bits (x86 de 64 bits = 'AMD64' ou 'Intel64')")
} else {
  Duv "o Windows e' de 32 bits. A app para x86 precisa do Windows de 64 bits."
}

$EhARM = ($Modelo -match "ARM|Snapdragon|Oryon|Apple") -or ($Processador -eq 5)

# O tipo de binario que este PC espera. Numa maquina ARM o instalador poe a
# variante ARM64 (e AI que esta certo), por isso a comparacao tem de ser feita
# contra o arquitectura da maquina e nao contra um "x64" fixo - senao num PC ARM
# o script acusava um falso erro no que esta perfeitamente bem.
$EsteTipo = if ($EhARM) { "ARM64" } else { "x64" }
Write-Host ("  tipo esperado: " + $EsteTipo)

if ($EhARM) {
  Duv "este PC e' ARM. Entao o teste do programa nativo x86 nao se aplica aqui."
  Write-Host "          (num PC ARM corre o binario ARM64, que e' o correcto.)"
} else {
  OK "processador x86 normal - este e' o teste certo"
}

# --------------------------------------------------- 2. OS FICHEIROS PUBLICADOS
Cab "2. OS FICHEIROS NA RELEASE"

$Versao = $null
try {
  $Tag = (Invoke-RestMethod -Uri "https://api.github.com/repos/boda07/meida/releases/latest" -Headers @{ "User-Agent" = "meida" } -TimeoutSec 40).tag_name
  if ($Tag) { $Versao = $Tag.Trim() -replace "^v", "" }
  if ($Versao) {
    OK ("release mais recente no GitHub: " + $Versao)
  } else {
    Duv "a release do GitHub nao respondeu com um numero de versao"
  }
} catch {
  Duv ("nao consegui ler as releases do GitHub: " + $_.Exception.Message)
}

# ------------------------------------------------------- 3. OS PROGRAMAS DENTRO
# Esta e' a parte importante. O bug era um programa do tamanho errado dentro
# do pacote, e nao se via de fora - era preciso abrir os ficheiros.
Cab "3. O PROGRAMA DENTRO DO PACOTE (a parte que estava partida)"

# Onde procurar: a app ja instalada, ou a zip que o script de reparacao descompacta.
$Locais = @()
$Instalada = Join-Path $env:LOCALAPPDATA "Programs\streamapp"
if (Test-Path $Instalada) { $Locais += $Instalada }

# Nomes das zips a procurar. A versao vem do GitHub; se isso falhar, aceita-se
# qualquer MEIDA-*-win.zip que esteja na pasta de release. Antes a versao
# "1.2.8" estava escrita a mao aqui, o que obrigava a editar o script a cada
# release.
$NomesZip = @()
if ($Versao) {
  $NomesZip += "MEIDA-$Versao-win.zip"
  $NomesZip += "MEIDA-$Versao-arm64-win.zip"
}
if (Test-Path "release") {
  $NomesZip += @(Get-ChildItem "release" -Filter "MEIDA-*-win.zip" -ErrorAction SilentlyContinue |
                 Select-Object -ExpandProperty Name)
}

foreach ($Nome in ($NomesZip | Select-Object -Unique)) {
  if (-not $Nome) { continue }
  foreach ($Pasta in @($env:TEMP, "$env:USERPROFILE")) {
    $Z = Join-Path $Pasta $Nome
    if (Test-Path $Z) { $Locais += $Z; break }
  }
}
# Tambem a pasta de release, se tiveres o repo clonado.
foreach ($Nome in ($NomesZip | Select-Object -Unique)) {
  $Z = Join-Path "release" $Nome
  if (Test-Path $Z) { $Locais += (Resolve-Path $Z).Path }
}

if ($Locais.Count -eq 0) {
  Duv "nao encontrei a app instalada nem a zip."
  Write-Host "          Instala a app (ou corre o script de reparacao) e repete."
} else {
  foreach ($Lugar in $Locais) {
    Write-Host ("  --> " + $Lugar)

    # Que tipo se espera aqui? Na app instalada, o da maquina. Numa zip, o que o
    # proprio nome diz: MEIDA-<ver>-win.zip = x64, MEIDA-<ver>-arm64-win.zip =
    # ARM64. Sem isto, a zip arm64 era comparada com o x64 do PC e dava um erro
    # falso, quando o pacote estava certo.
    $Esperado = $EsteTipo
    if ($Lugar.EndsWith(".zip")) {
      if ($Lugar -match "arm64") { $Esperado = "ARM64" }
      else { $Esperado = "x64" }
    }
    Write-Host ("  esperado : " + $Esperado)

    if ($Lugar.EndsWith(".zip")) {
      $Destino = Join-Path $env:TEMP ("meida-teste-" + [System.IO.Path]::GetFileNameWithoutExtension($Lugar))
      Remove-Item $Destino -Recurse -Force -ErrorAction SilentlyContinue
      try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::ExtractToDirectory($Lugar, $Destino)
      } catch {
        Mal ("nao consegui abrir a zip: " + $_.Exception.Message)
        continue
      }
      $Raiz = $Destino
    } else {
      $Raiz = $Lugar
    }

    # --- o executavel principal
    $Exe = Join-Path $Raiz "MEIDA.exe"
    if (-not (Test-Path $Exe)) {
      Mal "nao encontrei o MEIDA.exe"
    } else {
      Write-Host ("  app      : " + $Raiz)
      Write-Host ("  versao   : " + (Get-Item $Exe).VersionInfo.ProductVersion)
      Write-Host ("  tamanho  : " + [Math]::Round((Get-Item $Exe).Length / 1MB, 1) + " MB")

      $Tipo = TipoDe $Exe
      if ($Tipo -eq $Esperado) {
        OK ("o programa principal e' do tipo " + $Esperado + " (certo)")
      } else {
        Mal ("o programa principal e' " + $Tipo + " - aqui esperava-se " + $Esperado)
        Write-Host "          E' o bug do instalador: o pacote trouxe o programa de outra maquina."
      }
    }

    # --- o programa nativo do servidor (o que causava o problema)
    $Nativo = Join-Path $Raiz "resources\server\node_modules\node-datachannel\build\Release\node_datachannel.node"
    if (-not (Test-Path $Nativo)) {
      Mal "nao encontrei o programa nativo do servidor"
      Write-Host "          (node-datachannel). Sem ele os torrents nao funcionam."
    } else {
      Write-Host ("  nativo   : " + [Math]::Round((Get-Item $Nativo).Length / 1MB, 1) + " MB")
      $TN = TipoDe $Nativo
      if ($TN -eq $Esperado) {
        OK ("o programa nativo e' " + $Esperado + " (certo)")
      } elseif ($TN -eq "ARM64") {
        Mal "o programa nativo e' ARM64 - e' este o bug que estragava os PCs x86"
        Write-Host "          Volta a instalar a partir da release mais recente."
      } else {
        Mal ("o programa nativo e' " + $TN + " - aqui esperava-se " + $Esperado)
      }
    }

    # --- o resto: confirma que nao ha nenhum outro programa estragado
    $PastaModulos = Join-Path $Raiz "resources\server\node_modules"
    if (Test-Path $PastaModulos) {
      $Estranhos = @()
      Get-ChildItem $PastaModulos -Recurse -Include "*.node", "*.dll" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notlike "*\prebuilds\*" } |
        ForEach-Object {
          $TT = TipoDe $_.FullName
          if ($TT -and $TT -ne $Esperado) {
            $Estranhos += ($_.FullName.Replace($PastaModulos + "\", "") + " (tipo " + $TT + ")")
          }
        }
      if ($Estranhos.Count -eq 0) {
        OK "nenhum outro programa com o tipo errado"
      } else {
        foreach ($E in $Estranhos) { Mal ("programa com o tipo errado: " + $E) }
      }
    }
  }
}

# ------------------------------------------ 4. O SERVIDOR ARRANCA E RESPONDE
Cab "4. O SERVIDOR INTERNO"

$Porta = "5175"
$FPorta = Join-Path $env:APPDATA "streamapp\porta.txt"
if (Test-Path $FPorta) { $Porta = (Get-Content $FPorta -Raw).Trim() }

$ExeInstalado = Join-Path $Instalada "MEIDA.exe"
if (-not (Test-Path $ExeInstalado)) {
  Duv "a app nao esta instalada, por isso nao posso testar o servidor"
} else {
  Write-Host ("  a testar se o servidor arranca (porta " + $Porta + ")...")

  # Arranca o servidor sem abrir a janela: o MEIDA.exe tambem e' o Node.
  $Env:ELECTRON_RUN_AS_NODE = "1"
  $Servidor = Join-Path $Instalada "resources\server\src\index.js"
  $Antes = @(Get-Process -Name "MEIDA", "electron" -ErrorAction SilentlyContinue).Count

  $TmpOut = Join-Path $env:TEMP "meida-teste-server.out"
  $TmpErr = Join-Path $env:TEMP "meida-teste-server.err"
  Remove-Item $TmpOut, $TmpErr -Force -ErrorAction SilentlyContinue

  $P = Start-Process -FilePath $ExeInstalado -ArgumentList $Servidor -PassThru -NoNewWindow `
        -RedirectStandardOutput $TmpOut -RedirectStandardError $TmpErr

  $Respondeu = $false
  for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Seconds 1
    try {
      $R = Invoke-RestMethod -Uri ("http://127.0.0.1:" + $Porta + "/api/health") -TimeoutSec 5
      $Respondeu = $true
      break
    } catch {}
    if ($P.HasExited) { break }
  }

  if ($Respondeu) {
    OK "o servidor arrancou e respondeu"
    Write-Host ("  health   : " + ($R | ConvertTo-Json -Compress))
  } else {
    Mal "o servidor NAO arrancou (ou demorou mais de 25 s)"
    Write-Host "          Este era o sintoma do bug. Ve o log abaixo."
  }

  # --- o programa nativo carrega mesmo?
  Write-Host ""
  Write-Host "  a testar o programa nativo (torrents)..."
  $ModulosSlash = ($Instalada -replace '\\', '/') + "/resources/server/node_modules"
  # O corpo do comando e' montado aqui e passado ja pronto, para nao partir a
  # chamada em varios argumentos.
  $CorpoNativo = 'const t=require("' + $ModulosSlash + '/node-datachannel");console.log("MEIDA_NATIVO="+(typeof t.PeerConnection))'
  $R2 = TestarNode $ExeInstalado "MEIDA_NATIVO" $CorpoNativo
  if ($R2 -match "MEIDA_NATIVO=function") {
    OK "o programa nativo carrega - os torrents funcionam"
  } else {
    Mal "o programa nativo NAO carrega"
    if ($R2) { Write-Host ("  resposta : " + $R2) }
    else    { Write-Host "  resposta : (nenhuma) - o Node morreu ao tentar carregar" }
    Write-Host "          Se for este, o pacote tem o programa com o tipo errado (bloco 3)."
  }

  # --- e o webtorrent todo?
  Write-Host ""
  Write-Host "  a testar o webtorrent completo (torrents)..."
  # O webtorrent e' ESM, por isso o ficheiro tem de ser .mjs e o import dinamico.
# O catch e' do proprio Promise (um try/catch em volta nao apanha a rejeicao, e
# o processo saia com codigo 1 sem imprimir nada).
# O webtorrent e' ESM, por isso o ficheiro tem de ser .mjs e o import dinamico.
# O import() exige um URL file:// (um caminho C:/ da erro), e o catch tem de ser
# do proprio Promise. O setTimeout de 20 s e' a rede de seguranca: o
# new WebTorrent() liga-se a trackers e pode ficar la preso, e um script que
# fica pendurado e pior do que um script que diz "nao deu".
$WtUrl = "file:///" + (($Instalada -replace '\\', '/') -replace ' ', '%20')
$CorpoWt = 'setTimeout(()=>{console.log("MEIDA_PEER=demorou")},20000);' +
           'import("' + $WtUrl + '/resources/server/node_modules/webtorrent/index.js").then(m=>{const W=m.default||m;const c=new W();console.log("MEIDA_PEER="+(c.peerId||"vazio"));process.exit(0)}).catch(e=>console.log("MEIDA_PEER=ERRO:"+e.message))'
  $R3 = TestarNode $ExeInstalado "MEIDA_PEER" $CorpoWt ".mjs"
  if ($R3 -match "MEIDA_PEER=[0-9a-f]{10,}") {
    OK "o webtorrent arranca e gera peer id - os torrents vao funcionar"
  } elseif ($R3 -match "MEIDA_PEER=ERRO") {
    Duv "o webtorrent deu erro ao arrancar"
    Write-Host ("  resposta : " + $R3)
  } elseif ($R3 -match "MEIDA_PEER=demorou") {
    Duv "o webtorrent demorou mais de 20 s a arrancar (pode ser a ligacao aos trackers)"
  } else {
    Duv "o webtorrent nao arrancou"
    Write-Host "          (o aviso 'uTP not supported' e' normal e' inofensivo)"
  }

  # --- os torrents respondem?
  try {
    $T = Invoke-RestMethod -Uri ("http://127.0.0.1:" + $Porta + "/api/torrents?type=movie&imdb=tt0133093&title=Matrix") -TimeoutSec 40
    OK ("os torrents responderam (" + $T.torrents.Count + " resultados para Matrix)")
  } catch {
    Duv ("o pedido de torrents falhou: " + $_.Exception.Message)
  }

  # --- o catalogo responde? (a app precisa dele para mostrar seja o que for)
  try {
    $C = Invoke-RestMethod -Uri ("http://127.0.0.1:" + $Porta + "/api/catalog?titleLang=en") -TimeoutSec 40
    $NC = ($C | ConvertTo-Json -Depth 3 -Compress).Length
    OK ("o catalogo respondeu (" + $NC + " caracteres)")
  } catch {
    Duv ("o catalogo nao respondeu: " + $_.Exception.Message)
  }

  Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  try { if (-not $P.HasExited) { Stop-Process -Id $P.Id -Force -ErrorAction SilentlyContinue } } catch {}
  Remove-Item $TmpOut, $TmpErr -Force -ErrorAction SilentlyContinue
}

# ------------------------------------------------------------------ 5. LOG
Cab "5. O REGISTO DE ARRANQUE (se houver erro)"

$PastaLog = Join-Path $env:APPDATA "streamapp\logs"
if (Test-Path $PastaLog) {
  $Ultimo = Get-ChildItem $PastaLog -Filter "arranque-*.log" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($Ultimo) {
    Write-Host ("  ficheiro : " + $Ultimo.FullName)
    Write-Host ("  quando   : " + $Ultimo.LastWriteTime)
    Write-Host ""
    Write-Host "  ultimas linhas:"
    Get-Content $Ultimo.FullName -Tail 12 -ErrorAction SilentlyContinue |
      ForEach-Object { Write-Host ("    " + $_) }
  } else {
    Write-Host "  ainda nao ha registos."
  }
} else {
  Write-Host "  ainda nao ha registos (a app ainda nao arrancou neste PC)."
}

# ------------------------------------------------------------------ VEREDITO
Write-Host ""
Write-Host ("=" * 62)
if ($Erro -eq 0 -and $Aviso -eq 0) {
  Write-Host "VEREDITO: TUDO CERTO" -ForegroundColor Green
  Write-Host "  Este PC tem a MEIDA completa e a funcionar."
} elseif ($Erro -eq 0) {
  Write-Host "VEREDITO: FUNCIONA, COM AVISOS" -ForegroundColor Yellow
  Write-Host "  Nada de grave. Le os avisos acima."
} else {
  Write-Host "VEREDITO: HA PROBLEMAS" -ForegroundColor Red
  Write-Host ("  " + $Erro + " coisa(s) a falhar. Ve o bloco 3 e o registo no bloco 5.")
  Write-Host "  Se for o programa nativo, reinstala a partir da release mais recente."
}
Write-Host ("=" * 62)

if ($Erro -gt 0) { exit 1 } else { exit 0 }