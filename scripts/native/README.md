# Porquê que estes dois ficheiros estão no repositório

`node_datachannel.win32-x64.node` e `node_datachannel.win32-arm64.node` são os
binários oficiais do `node-datachannel` 0.32.3, tirados dos *prebuilds* do
projecto (`murat-dogan/node-datachannel`, release `v0.32.3`, variante
`napi-v8`). São os mesmos ficheiros que o `prebuild-install` descompacta quando
se instala o pacote — guardamo-los aqui para não depender da rede durante a
build.

São N-API, portanto servem tanto para o Node como para o Electron, em qualquer
versão.

Quem os usa: `scripts/empacotar-nativos.cjs`, o hook `afterPack` do
`electron-builder`. Para cada arquitectura que está a ser empacotada, copia o
binário certo para dentro do pacote e depois varre tudo à procura de
arquitecturas erradas — se encontrar alguma, a build falha em vez de deixar sair
uma app que não arranca.

**Ao acrescentar um `.node` novo ao `server/`, é preciso** pô-lo no `TROCAR` do
hook, senão a build falha (é o comportamento pretendido: força a pensar).

NÃO substituir estes ficheiros por versões compiladas localmente: a máquina de
desenvolvimento é Windows sobre ARM, e o que ela compila é sempre ARM64.