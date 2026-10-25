// Avatares predefinidos (emoji). O utilizador pode também usar um URL de imagem.
export const AVATAR_EMOJIS = [
  "🦊", "🐼", "🐱", "🦁", "🐯", "🐸", "🐵", "🐶",
  "🐺", "🐲", "👾", "🤖", "🎬", "🍿", "⭐", "🔥",
];

// Renderiza o avatar de um utilizador: imagem (URL), emoji predefinido
// ("emoji:🦊") ou, em último caso, a inicial do nome.
//
// Se `avatar` for nulo mas houver `userId`, busca o avatar separadamente via
// `GET /api/users/:id/avatar`. Assim, as listas (comentarios, notificacoes,
// seguidores) nao precisam de trazer o avatar inline — evitando que um avatar
// de 200 KB seja repetido 20 vezes numa conversa.
import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function Avatar({ avatar, name = "?", size = 38, userId }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.5) };
  // O valor buscado via API (só usado quando não há avatar direto).
  // Guardado em estado porque vem de uma promise assíncrona.
  const [buscado, setBuscado] = useState(null);

  useEffect(() => {
    // So busca se nao houver valor direto e houver um id para consultar.
    if (avatar || !userId) return;
    let cancelled = false;
    api
      .userAvatar(userId)
      .then(({ avatar: a }) => {
        if (!cancelled && a) setBuscado(a);
      })
      .catch(() => {
        // Falhou a busca: fica sem avatar, mostra a inicial. Nao e' grave.
      });
    return () => {
      cancelled = true;
    };
  }, [avatar, userId]);

  // O valor direto (prop) tem prioridade sobre o buscado, e muda sempre que o
  // prop muda — não fica preso a um valor antigo.
  const a = avatar || buscado;

  if (a && /^(https?:\/\/|data:image\/)/i.test(a)) {
    return <img className="avatar-img" src={a} alt={name} style={style} />;
  }
  if (a && a.startsWith("emoji:")) {
    return (
      <span className="avatar-emoji" style={style}>
        {a.slice(6)}
      </span>
    );
  }
  return (
    <span className="avatar-initial" style={style}>
      {(name[0] || "?").toUpperCase()}
    </span>
  );
}
