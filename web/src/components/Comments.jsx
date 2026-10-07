// Comentarios de um episodio (ou de um filme). A chave e' (type, tmdbId,
// season, episode): ao mudar de episodio, a lista recarrega sozinha.
import { Fragment, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import { haQuanto, quandoCompleto, paraTempo, paraSegundos } from "../lib/tempo.js";

// O tempo no video e a data sao os dois de web/src/lib/tempo.js (com testes).
// Aqui so' se decide o que se mostra.

function CommentItem({ c, user, onLike, onDelete, onReply }) {
  const mine = user && c.author.id === user.id;
  const clock = paraTempo(c.atSeconds);
  return (
    <li className={`comment ${c.deleted ? "is-deleted" : ""}`}>
      <Avatar avatar={c.author.avatar} name={c.author.username} size={34} />
      <div className="comment-body">
        <div className="comment-head">
          <Link className="comment-author" to={`/u/${encodeURIComponent(c.author.username)}`}>
            {c.author.username}
          </Link>
          {clock && (
            <span className="comment-clock" title={whenTitle(c.atSeconds)}>
              ⏱ {clock}
            </span>
          )}
          {/* "ha 10 s atras" em vez de "07 out": numa conversa recem-escrita a
              data nao diz nada, e obriga a fazer as contas. O title traz a data
              exacta para quando ja nao e' recente. */}
          <span className="comment-when" title={quandoCompleto(c.createdAt)}>
            {haQuanto(c.createdAt)}
          </span>
        </div>
        <p className="comment-text">
          {c.deleted ? <em className="muted">Comentário apagado</em> : c.body}
        </p>
        {!c.deleted && (
          <div className="comment-actions">
            {/* A contagem aparece sempre, mesmo a zero. Antes so aparecia com
                likes > 0, o que fazia o botao ser um coracao solto sem
                contexto — e a pessoa concluia que nao havia likes. */}
            <button
              className={`comment-like ${c.likedByMe ? "on" : ""}`}
              onClick={() => onLike(c)}
              disabled={!user}
              aria-pressed={c.likedByMe ? "true" : "false"}
              title={user ? (c.likedByMe ? "Tirar o gosto" : "Gostar") : "Entra para gostar"}
            >
              <span className="comment-like-icone" aria-hidden="true">
                {c.likedByMe ? "♥" : "♡"}
              </span>
              <span>{c.likes}</span>
            </button>
            {user && <button className="comment-link" onClick={() => onReply(c.id)}>Responder</button>}
            {mine && <button className="comment-link danger" onClick={() => onDelete(c.id)}>Apagar</button>}
          </div>
        )}
        {c.replies?.length > 0 && (
          <ul className="comment-replies">
            {c.replies.map((r) => (
              <CommentItem key={r.id} c={r} user={user} onLike={onLike} onDelete={onDelete} onReply={onReply} />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

// Title do ⏱: "minuto 125 do video" em vez de repetir "2:05" ao lado de si.
function whenTitle(seg) {
  const n = Number(seg);
  if (!Number.isFinite(n)) return "";
  return `Minuto do vídeo: ${paraTempo(n)} (${Math.round(n)} segundos)`;
}

// `posAtual` e' a posicao do player em segundos, quando ha player nosso a dar
// progresso. Nos providers (iframe) nao ha — dai o botao so aparecer com valor.
export default function Comments({ type, tmdbId, season = null, episode = null, posAtual = null }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [atTime, setAtTime] = useState(""); // o que a pessoa escreve: "2:05"
  const atSegundos = paraSegundos(atTime); // null se nao der para interpretar
  const atErrado = atTime.trim() !== "" && atSegundos === null;
  const [replyTo, setReplyTo] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!type || !tmdbId) return;
    setLoading(true);
    api
      .comments({ type, tmdbId, season, episode })
      .then((d) => setComments(d.comments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [type, tmdbId, season, episode]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.addComment({
        type,
        tmdbId,
        season,
        episode,
        body: body.trim(),
        atSeconds: atSegundos,
      });
      setBody("");
      setAtTime("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReply(parentId) {
    if (!replyBody.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.addComment({ type, tmdbId, season, episode, parentId, body: replyBody.trim() });
      setReplyBody("");
      setReplyTo(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleLike(c) {
    if (!user) return;
    try {
      if (c.likedByMe) await api.unlikeComment(c.id);
      else await api.likeComment(c.id);
      load();
    } catch {
      /* ignora: o proximo load repõe o estado real */
    }
  }

  async function remove(id) {
    if (!window.confirm("Apagar este comentário?")) return;
    try {
      await api.deleteComment(id);
      if (replyTo === id) setReplyTo(null);
      load();
    } catch {
      /* ignora */
    }
  }

  return (
    <section className="comments">
      <h3 className="comments-title">Comentários</h3>

      {user ? (
        <form className="comment-form" onSubmit={submit}>
          <Avatar avatar={user.avatar} name={user.username} size={36} />
          <div className="comment-form-main">
            <textarea
              className="comment-input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Diz o que achaste..."
              rows={2}
              maxLength={2000}
            />
            <div className="comment-form-foot">
              <label className={`comment-at ${atErrado ? "erro" : ""}`}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={atTime}
                  onChange={(e) => setAtTime(e.target.value)}
                  placeholder="0:00"
                  title="Momento do vídeo (opcional). Aceita 2:05 ou 125."
                  maxLength={8}
                />
                <span>momento</span>
              </label>
              {/* So com os nossos players, que dizem a posicao. Nos providers
                  (iframe) nao ha tempo a que pegar, por isso o botao nao aparece
                  em vez de aparecer desactivado. */}
              {posAtual != null && posAtual > 0 && (
                <button
                  type="button"
                  className="comment-link"
                  onClick={() => setAtTime(paraTempo(posAtual))}
                  title="Usar o momento em que estás"
                >
                  ⏱ neste momento
                </button>
              )}
              <button className="lib-watched" disabled={busy || !body.trim() || atErrado}>
                Comentar
              </button>
            </div>
          </div>
        </form>
      ) : (
        <p className="muted">
          <Link to="/login">Entra</Link> para comentar.
        </p>
      )}

      {atErrado && (
        <p className="comment-aviso">
          Esse momento não se percebe. Escreve 2:05 ou 125.
        </p>
      )}

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="muted">A carregar comentários...</p>
      ) : comments.length === 0 ? (
        <p className="muted">Ainda sem comentários. Sê o primeiro.</p>
      ) : (
        <ul className="comment-list">
          {comments.map((c) => (
            <Fragment key={c.id}>
              <CommentItem
                c={c}
                user={user}
                onLike={toggleLike}
                onDelete={remove}
                onReply={(id) => setReplyTo(replyTo === id ? null : id)}
              />
              {replyTo === c.id && user && (
                <li className="comment-reply-form">
                  <textarea
                    className="comment-input"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={`Responder a ${c.author.username}...`}
                    rows={2}
                    maxLength={2000}
                  />
                  <div className="comment-form-foot">
                    <button className="comment-link" onClick={() => setReplyTo(null)}>
                      Cancelar
                    </button>
                    <button
                      className="lib-watched"
                      disabled={busy || !replyBody.trim()}
                      onClick={() => submitReply(c.id)}
                    >
                      Responder
                    </button>
                  </div>
                </li>
              )}
            </Fragment>
          ))}
        </ul>
      )}
    </section>
  );
}
