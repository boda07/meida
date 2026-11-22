// Ligacoes e regras pequenas do feed de atividade.
//
// Fica fora do componente para poder ser testado sem React. A regra importante
// e' o link: um episodio leva `?s=&e=` para a ficha abrir no episodio certo (a
// ficha ja' sabe ler estes parametros e posicionar-se). Sem isto, carregar em
// "viu o episodio 3" abria sempre no episodio 1 e obrigava a procurar.

/** Link para a ficha do titulo, no episodio certo quando ha episodio. */
export function linkDaAtividade(it) {
  // i18n: e' um caminho da app, nao texto de interface
  const base = `/details/${encodeURIComponent(it.type)}/${encodeURIComponent(it.tmdbId)}`;
  if (it.kind !== "episode") return base;
  const q = new URLSearchParams();
  if (it.season != null) q.set("s", it.season);
  if (it.episode != null) q.set("e", it.episode);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}
