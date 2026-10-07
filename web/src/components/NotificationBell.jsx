// O sino de notificacoes: contagem no header e painel com a lista.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import { haQuanto } from "../lib/tempo.js";

const INTERVALO_MS = 60 * 1000; // um minuto chega: notifica-se para outra coisa

/** Texto de cada tipo de notificacao. */
function frase(n) {
  const quem = n.actor ? n.actor.username : "alguém";
  if (n.kind === "reply") return { texto: `${quem} respondeu ao teu comentário`, forte: quem };
  if (n.kind === "like") return { texto: `${quem} gostou do teu comentário`, forte: quem };
  if (n.kind === "follow") return { texto: `${quem} começou a seguir-te`, forte: quem };
  return { texto: "Novidade", forte: "Novidade" };
}

/** Para onde leva cada notificacao. */
function destinoDe(n) {
  if (n.kind === "follow" && n.actor) return `/u/${encodeURIComponent(n.actor.username)}`;
  if (n.type && n.tmdbId != null) {
    const q = new URLSearchParams();
    if (n.season != null) q.set("s", String(n.season));
    if (n.episode != null) q.set("e", String(n.episode));
    const qs = q.toString();
    return `/details/${n.type}/${n.tmdbId}${qs ? `?${qs}` : ""}`;
  }
  return null;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navegar = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [items, setItems] = useState([]);
  const [naoLidas, setNaoLidas] = useState(0);
  // A caixa fecha ao clicar fora e ao carregar em Escape. Um <details>/<summary>
  // dava isto de graca, mas nao deixa fechar ao clicar outra vez e complica
  // marcar tudo como lido ao abrir.
  const caixaRef = useRef(null);

  const carregar = useCallback(async () => {
    if (!user) return;
    try {
      const d = await api.notifications();
      setItems(d.items || []);
      setNaoLidas(d.unread ?? 0);
    } catch {
      /* sem notificacoes nao e' motivo para mostrar nada */
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setNaoLidas(0);
      return;
    }
    carregar();
    const t = setInterval(carregar, INTERVALO_MS);
    return () => clearInterval(t);
  }, [user, carregar]);

  // Recarrega ao voltar para o separador: se a pessoa deixou a app aberta
  // noutra janela, o sino antigo é pior do que uma espera.
  useEffect(() => {
    if (!user) return undefined;
    const aoVoltar = () => {
      if (document.visibilityState === "visible") carregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [user, carregar]);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => {
      if (caixaRef.current && !caixaRef.current.contains(e.target)) setAberto(false);
    };
    const esc = (e) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  // Abrir o painel marca tudo como lido. É o que toda a gente espera — e o
  // número do sino é o único sítio onde se vê que há algo novo.
  async function abrir() {
    const proximo = !aberto;
    setAberto(proximo);
    if (proximo && naoLidas > 0) {
      setNaoLidas(0);
      try {
        await api.markAllNotificationsRead();
      } catch {
        /* se falhar, da proxima vez volta a tentar */
      }
    }
  }

  function irPara(n) {
    const d = destinoDe(n);
    setAberto(false);
    if (d) navegar(d);
  }

  if (!user) return null;

  return (
    <div className="notif" ref={caixaRef}>
      <button
        type="button"
        className={`notif-sino ${naoLidas > 0 ? "com" : ""}`}
        onClick={abrir}
        aria-expanded={aberto}
        aria-label={
          naoLidas > 0 ? `Notificações: ${naoLidas} por ler` : "Notificações"
        }
        title="Notificações"
      >
        <svg
          aria-hidden="true"
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {naoLidas > 0 && (
          <span className="notif-conta">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="notif-painel" role="dialog" aria-label="Notificações">
          <div className="notif-topo">
            <strong>Notificações</strong>
          </div>
          {items.length === 0 ? (
            <p className="notif-vazio">Nada por aqui. Quando alguém responder a um comentário teu ou gostar dele, aparece aqui.</p>
          ) : (
            <ul className="notif-lista">
              {items.map((n) => {
                const { texto, forte } = frase(n);
                const d = destinoDe(n);
                const conteudo = (
                  <>
                    {n.actor ? (
                      <Avatar avatar={n.actor.avatar} name={n.actor.username} size={30} />
                    ) : (
                      <span className="notif-avatar-vazio" aria-hidden="true" />
                    )}
                    <span className="notif-texto">
                      {/* A parte que nomeia a pessoa vai forte; o resto e' quieto. */}
                      <span>
                        <strong>{forte}</strong>
                        {texto.slice(forte.length)}
                      </span>
                      {n.preview && <span className="notif-preview">“{n.preview}”</span>}
                      <span className="notif-quando">{haQuanto(n.createdAt)}</span>
                    </span>
                  </>
                );
                return (
                  <li key={n.id}>
                    {d ? (
                      <Link to={d} className="notif-item" onClick={() => setAberto(false)}>
                        {conteudo}
                      </Link>
                    ) : (
                      <button type="button" className="notif-item" onClick={() => irPara(n)}>
                        {conteudo}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
