// A frase de uma atividade, montada com `t()` e elementos React dentro dos
// placeholders — a mesma técnica dos comentários e da Home. Assim a tradução
// muda a frase toda sem partir os links do nome e do título ao meio.
//
// Fica fora do `ActivityList` para a lista desenhar e nada mais, e para a parte
// com regras (qual é a frase de cada `kind`) poder ser lida sem montar o
// componente.
import { Link } from "react-router-dom";
import { linkDaAtividade } from "../lib/atividade.js";

function textoEpisodio(it, titulo, quem, t) {
  if (it.season != null && it.episode != null) {
    return t("{user} viu o episódio {ep} da temporada {season} de {title}", {
      user: quem,
      ep: it.episode,
      season: it.season,
      title: titulo,
    });
  }
  if (it.episode != null) {
    return t("{user} viu o episódio {ep} de {title}", {
      user: quem,
      ep: it.episode,
      title: titulo,
    });
  }
  // Sem número de episódio (importações antigas, por exemplo): não se inventa
  // um número. Diz-se o título e mais nada.
  return t("{user} viu {title}", { user: quem, title: titulo });
}

export function fraseDaAtividade(it, t) {
  const titulo = (
    <Link key="titulo" className="activity-title-link" to={linkDaAtividade(it)}>
      {it.title || t("Sem título")}
    </Link>
  );
  const quem = it.user?.username ? (
    <Link
      key="quem"
      className="activity-user-link"
      to={`/u/${encodeURIComponent(it.user.username)}`}
    >
      {it.user.username}
    </Link>
  ) : (
    t("Alguém")
  );

  if (it.kind === "episode") return textoEpisodio(it, titulo, quem, t);
  if (it.kind === "series") return t("{user} viu a série {title}", { user: quem, title: titulo });
  return t("{user} viu o filme {title}", { user: quem, title: titulo });
}