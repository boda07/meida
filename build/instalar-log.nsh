; Verificacao pos-instalacao.
;
; Porque: o `electron-builder` 26.15.3 nao tem opcao `logging` no bloco `nsis`
; (verificar em node_modules/app-builder-lib/scheme.json -> NsisOptions: so' ha
; `include`). Sem log, um ficheiro que falhe a extrair e' completamente
; silencioso — o instalador acaba com codigo 0, escreve o registo, cria o
; desinstalador, e o ficheiro simplesmente nao esta la.
;
; Foi EXACTAMENTE o que aconteceu na 1.3.6 em ARM: o `MEIDA.exe` e mais 6 DLL
; ficaram de fora em todas as instalacoes, sem um unico aviso. Este include
; escreve o que encontrou, para se ver o que se passou em vez de adivinhar.
;
; `LogSet` tem de estar dentro de uma seccao — o `include` e' inserido no topo do
; script, fora de qualquer uma — por isso e' aqui, no `customInstall`, que o
; `installSection.nsh` chama de dentro da seccao de instalacao.
;
; Escreve "$INSTDIR\instalacao.txt".

!macro verificarArquivo RESULTADO CAMINHO NOME
  ${if} ${FileExists} "${CAMINHO}"
    FileWrite $0 "  OK    ${NOME}${CRLF}"
  ${else}
    StrCpy ${RESULTADO} 1
    FileWrite $0 "  FALTA ${NOME}   <<<<<<${CRLF}"
  ${endif}
!macroend

!macro customInstall
  LogSet on

  FileOpen $0 "$INSTDIR\instalacao.txt" w
  FileWrite $0 "MEIDA — verificacao da instalacao${CRLF}"
  FileWrite $0 "Installer: ${PRODUCT_NAME} ${PRODUCT_VERSION}${CRLF}"
  FileWrite $0 "Arquitectura instalada: $packageArch${CRLF}"
  FileWrite $0 "Pasta: $INSTDIR${CRLF}${CRLF}"

  StrCpy $1 0

  FileWrite $0 "Executavel:${CRLF}"
  !insertmacro verificarArquivo $1 "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "MEIDA.exe"

  FileWrite $0 "${CRLF}Bibliotecas do Electron:${CRLF}"
  !insertmacro verificarArquivo $1 "$INSTDIR\ffmpeg.dll" "ffmpeg.dll"
  !insertmacro verificarArquivo $1 "$INSTDIR\vulkan-1.dll" "vulkan-1.dll"
  !insertmacro verificarArquivo $1 "$INSTDIR\d3dcompiler_47.dll" "d3dcompiler_47.dll"
  !insertmacro verificarArquivo $1 "$INSTDIR\dxcompiler.dll" "dxcompiler.dll"
  !insertmacro verificarArquivo $1 "$INSTDIR\dxil.dll" "dxil.dll"
  !insertmacro verificarArquivo $1 "$INSTDIR\vk_swiftshader.dll" "vk_swiftshader.dll"

  FileWrite $0 "${CRLF}Carga da app:${CRLF}"
  !insertmacro verificarArquivo $1 "$INSTDIR\resources\app.asar" "resources/app.asar"
  !insertmacro verificarArquivo $1 "$INSTDIR\resources\resources.pak" "resources/resources.pak"

  ${if} $1 != 0
    FileWrite $0 "${CRLF}RESULTADO: INCOMPLETA — a app nao vai arrancar.${CRLF}"
  ${else}
    FileWrite $0 "${CRLF}RESULTADO: completa.${CRLF}"
  ${endif}

  FileClose $0
!macroend
