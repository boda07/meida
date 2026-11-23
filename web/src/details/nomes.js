// Nomes de temporada e de episodio no idioma da interface.
//
// Funcoes puras: o servidor devolve o nome do espelho (ex. "Temporada 1" ou
// "Season 1") e o cliente mostra no idioma escolhido. Nomes proprios (ex.
// "Parte 2") sao mostrados tal como estao.

export function nomeTemporada(s, t) {
  if (!s.seasonNumber) return t("Especiais");
  if (!s.name || /^(Temporada|Season)\s*\d+$/i.test(s.name)) {
    return t("Temporada {n}", { n: s.seasonNumber });
  }
  return s.name;
}

export function nomeEpisodio(s, t) {
  if (!s) return s;
  const m = /^(Episódio|Episode)\s+(\d+)$/i.exec(s);
  if (m) return t("Episódio {n}", { n: Number(m[2]) });
  return s;
}