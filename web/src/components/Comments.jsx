// Comentarios de um episodio (ou de um filme). A chave e' (type, tmdbId,
// season, episode): ao mudar de episodio, a lista recarrega sozinha.
import { Fragment, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import Avatar from "./Avatar.jsx";

// 125 -> "2:05". Devolve null quando nao ha marca no video.
function fmtClock(s) {
  if (s == null) return null;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function CommentItem({ c, user, onLike, onDelete, onReply }) {
  const mine = user && c.author.id === user.id;
  const clock = fmtClock(c.atSeconds);
  return (
    <li className={`comment ${c.deleted ? "is-deleted" : ""}`}>
      <Avatar avatar={c.author.avatar} name={c.author.username} size={34} />
      <div className="comment-body">
        <div className="comment-head">
          <Link className="comment-author" to={`/u/${encodeURIComponent(c.author.username)}`}>
            {c.author.username}
          </Link>
          {clock && <span className="comment-clock" title="Minuto no vídeo">⏱ {clock}</span>}
          <span className="comment-when">{when(c.createdAt)}</span>
        </div>
        <p className="comment-text">
          {c.deleted ? <em className="muted">Comentário apagado</em> : c.body}
        </p>
        {!c.deleted && (
          <div className="comment-actions">
            <button
              className={`comment-like ${c.likedByMe ? "on" : ""}`}
              onClick={() => onLike(c)}
              disabled={!user}
              title={user ? "Gosto" : "Entra para gostar"}
            >
              ♥ {c.likes > 0 ? c.likes : ""}
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

export default function Comments({ type, tmdbId, season = null, episode = null }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [atSeconds, setAtSeconds] = useState("");
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
        atSeconds: atSeconds === "" ? null : Number(atSeconds),
      });
      setBody("");
      setAtSeconds("");
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
              <label className="comment-at" title="Marca o minuto do vídeo (opcional)">
                <input
                  type="number"
                  min="0"
                  value={atSeconds}
                  onChange={(e) => setAtSeconds(e.target.value)}
                  placeholder="—"
                />
                <span>seg</span>
              </label>
              <button className="lib-watched" disabled={busy || !body.trim()}>
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
