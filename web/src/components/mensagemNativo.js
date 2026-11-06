// Codigo de falha do extrator nativo -> mensagem que o utilizador percebe.
//
// O servidor devolve `codigo` + `detalhe`: o `codigo` e' um destes seis valores
// e o `detalhe` e' texto tecnico (HTTP 403, mensagem de rede, ...). Mostrar o
// detalhe no ecra dava frases em portugues sem acentos, mesmo em ingles (B2);
// por isso o detalhe fica na consola e o ecra recebe so' esta traducao.
//
// A funcao recebe o `t` para continuar pura: nao depende do contexto do React e
// pode ser testada com um `t` falso. As chaves sao literais de proposito — o
// auditor de traducoes so' ve' as chamadas `t("...")`.
export const CODIGOS_NATIVO = [
  "sem_data_id",
  "url_invalido",
  "http",
  "rede",
  "cifra",
  "sem_video",
];

export function mensagemNativo(codigo, t) {
  switch (codigo) {
    case "sem_data_id":
      return t("Nativo indisponível: o MegaPlay mudou e já não encontramos este episódio.");
    case "url_invalido":
      return t("Nativo indisponível: o endereço do MegaPlay não é válido.");
    case "http":
      return t("Nativo indisponível: o MegaPlay respondeu com um erro.");
    case "rede":
      return t("Nativo indisponível: não foi possível contactar o MegaPlay.");
    case "cifra":
      return t("Nativo indisponível: o MegaPlay mudou a proteção do vídeo.");
    case "sem_video":
      return t("Nativo indisponível: o MegaPlay não devolveu nenhum vídeo.");
    default:
      return t("Nativo indisponível: não foi possível reproduzir agora.");
  }
}
