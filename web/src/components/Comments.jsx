import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import { TextoComMencoes, CorpoDoComentario } from "./TextoComMencoes.jsx";
import { haQuanto, quandoCompleto, paraTempo, paraSegundos } from "../lib/tempo.js";
import { useT } from "../i18n/I18nContext.jsx";
import { useComments } from "./useComments.js";

// O tempo no video e a data sao os dois de web/src/lib/tempo.js (com testes).
// Aqui so' se decide o que se mostra.

// Respostas: a partir deste nivel a indentacao para. Cada nivel comia 14px de
// margem, e um fio de dez respostas deixava o texto numa tira estreita — no
// telefone, pior. Passado o limite, todas as respostas ficam no mesmo recuo e
// passa a ser a citacao do pai a dizer a quem se responde.
//
// O projeto antigo (RAI PAP / ProdSound) resolve a mesma coisa pelo outro lado:
// indenta a vontade e e' a `vp-comment-quote` que segura a conversa quando o
// recuo ja nao diz nada.
//
// O segundo limite e' so' seguranca: sem ele, um ciclo de `parent_id` nos dados
// prendia o browser num fio de recursao sem fim. Nao se cria um ciclo (ver
// `addComment` no store: o pai tem sempre de existir primeiro), por isso aos 30
// niveis nunca se chega. Se se chegar, corta-se e diz-se — em vez de desaparecer
// respostas sem dar conta.
export const NIVEL_INDENTA = 3;
export const NIVEL_MAXIMO = 30;

// O texto citado vai cortado: e' para lembrar de quem e' que se responde, nao
// para ler. 120 e' o mesmo limite que o projeto antigo usava.
function citado(body) {
  const s = String(body || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > 120 ? `${s.slice(0, 120).trimEnd()}...` : s;
}

// Exportado so' para o teste (`scripts/testar-comentarios-render.mjs`) poder
// montar um fio e ver o HTML. Nao e' usado pela app.
export function CommentItem({
  c,
  parent = null,
  nivel = 0,
  user,
  onLike,
  onDelete,
  onReply,
  replyTo,
  replyBody,
  setReplyBody,
  onSubmitReply,
  onCancelReply,
  busy,
}) {
  const t = useT();
  const mine = user && c.author.id === user.id;
  const clock = paraTempo(c.atSeconds);
  const aResponder = replyTo === c.id;
  const fundo = nivel > NIVEL_INDENTA;
  const cortado = nivel >= NIVEL_MAXIMO;
  const citacao = parent && citado(parent.body);
  return (
    <li
      id={`comentario-${c.id}`}
      className={`comment ${c.deleted ? "is-deleted" : ""}`}
    >
      <Avatar avatar={c.author.avatar} name={c.author.username} size={34} userId={c.author.id} />
      <div className="comment-body">
        <div className="comment-head">
          <Link className="comment-author" to={`/u/${encodeURIComponent(c.author.username)}`}>
            {c.author.username}
          </Link>
          {clock && (
            <span className="comment-clock" title={whenTitle(c.atSeconds, t)}>
              ⏱ {clock}
            </span>
          )}
          <span className="comment-when" title={quandoCompleto(c.createdAt)}>
            {haQuanto(c.createdAt)}
          </span>
        </div>
        {parent && (
          <a className="comment-cita" href={`#comentario-${parent.id}`} title={t("Ir para esse comentário")}>
            <span className="comment-cita-seta" aria-hidden="true">
              ↩
            </span>
            <span className="comment-cita-quem">{parent.author.username}</span>
            {citacao && <span className="comment-cita-texto">{citacao}</span>}
          </a>
        )}
        <p className="comment-text">
          {c.deleted ? (
            <em className="muted">{t("Comentário apagado")}</em>
          ) : (
            <CorpoDoComentario body={c.body} />
          )}
        </p>
        {!c.deleted && (
          <div className="comment-actions">
            <button
              className={`comment-like ${c.likedByMe ? "on" : ""}`}
              onClick={() => onLike(c)}
              disabled={!user}
              aria-pressed={c.likedByMe ? "true" : "false"}
              title={
                user
                  ? c.likedByMe
                    ? t("Tirar o gosto")
                    : t("Gostar")
                  : t("Entra para gostar")
              }
            >
              <span className="comment-like-icone" aria-hidden="true">
                {c.likedByMe ? "♥" : "♡"}
              </span>
              <span>{c.likes}</span>
            </button>
            {user && <button className="comment-link" onClick={() => onReply(c.id)}>{t("Responder")}</button>}
            {mine && (
              <button className="comment-link danger" onClick={() => onDelete(c.id)}>
                {t("Apagar")}
              </button>
            )}
          </div>
        )}
        {aResponder && user && (
          <div className="comment-reply-form">
            <TextoComMencoes
              value={replyBody}
              onChange={setReplyBody}
              placeholder={t("Responder a {u}...  (escreve @ para chamar alguém)", { u: c.author.username })}
              rows={2}
              maxLength={2000}
            />
            <div className="comment-form-foot">
              <button className="comment-link" onClick={onCancelReply}>
                {t("Cancelar")}
              </button>
              <button
                className="lib-watched"
                disabled={busy || !replyBody.trim()}
                onClick={() => onSubmitReply(c.id)}
              >
                {t("Responder")}
              </button>
            </div>
          </div>
        )}
        {c.replies?.length > 0 && !cortado && (
          <ul className={`comment-replies ${fundo ? "comment-replies-fundo" : ""}`}>
            {c.replies.map((r) => (
              <CommentItem
                key={r.id}
                c={r}
                parent={c}
                nivel={nivel + 1}
                user={user}
                onLike={onLike}
                onDelete={onDelete}
                onReply={onReply}
                replyTo={replyTo}
                replyBody={replyBody}
                setReplyBody={setReplyBody}
                onSubmitReply={onSubmitReply}
                onCancelReply={onCancelReply}
                busy={busy}
              />
            ))}
          </ul>
        )}
        {cortado && c.replies?.length > 0 && (
          <p className="muted comment-corte">
            {t("Há mais respostas aqui abaixo que não foi possível mostrar.")}
          </p>
        )}
      </div>
    </li>
  );
}

// Title do ⏱: "minuto 125 do video" em vez de repetir "2:05" ao lado de si.
// `t` entra como PARAMETRO: esta funcao nao e' um componente e nao pode usar o
// hook `useT()`.
function whenTitle(seg, t) {
  const n = Number(seg);
  if (!Number.isFinite(n)) return "";
  return t("Minuto do vídeo: {t} ({s} segundos)", { t: paraTempo(n), s: Math.round(n) });
}

// `posAtual` e' a posicao do player em segundos, quando ha player nosso a dar
// progresso. Nos providers (iframe) nao ha — dai o botao so aparecer com valor.
export default function Comments({ type, tmdbId, season = null, episode = null, posAtual = null }) {
  const t = useT();
  const { user } = useAuth();

  // Logica de comentarios via hook.
  const {
    comments,
    loading,
    error,
    busy,
    load,
    submit,
    submitReply,
    toggleLike,
    remove,
  } = useComments({ type, tmdbId, season, episode });

  // Estado do formulario (so UI).
  const [body, setBody] = useState("");
  const [atTime, setAtTime] = useState(""); // o que a pessoa escreve: "2:05"
  const atSegundos = paraSegundos(atTime); // null se nao der para interpretar
  const atErrado = atTime.trim() !== "" && atSegundos === null;
  const [replyTo, setReplyTo] = useState(null);
  const [replyBody, setReplyBody] = useState("");

  // Envio de comentario de topo.
  async function handleSubmit(e) {
    e.preventDefault();
    await submit({ body, atSeconds: atSegundos });
    if (!error) {
      setBody("");
      setAtTime("");
      load();
    }
  }

  // Envio de resposta.
  async function handleSubmitReply(parentId) {
    await submitReply(parentId, replyBody);
    if (!error) {
      setReplyBody("");
      setReplyTo(null);
      load();
    }
  }

  // Apagar com confirmacao (responsabilidade de UI, nao do hook de rede).
  async function handleRemove(id) {
    if (!window.confirm(t("Apagar este comentário?"))) return;
    await remove(id);
    load();
  }

  return (
    <section className="comments">
      <h3 className="comments-title">{t("Comentários")}</h3>

      {user ? (
        <form className="comment-form" onSubmit={handleSubmit}>
          <Avatar avatar={user.avatar} name={user.username} size={36} userId={user.id} />
          <div className="comment-form-main">
            <TextoComMencoes
              value={body}
              onChange={setBody}
              placeholder={t("Diz o que achaste...  (escreve @ para chamar alguém)")}
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
                  title={t("Momento do vídeo (opcional). Aceita 2:05 ou 125.")}
                  maxLength={8}
                />
                <span>{t("momento")}</span>
              </label>
              {posAtual != null && posAtual > 0 && (
                <button
                  type="button"
                  className="comment-link"
                  onClick={() => setAtTime(paraTempo(posAtual))}
                  title={t("Usar o momento em que estás")}
                >
                  {t("⏱ neste momento")}
                </button>
              )}
              <button className="lib-watched" disabled={busy || !body.trim() || atErrado}>
                {t("Comentar")}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <p className="muted">
          <Link to="/login">{t("Entra")}</Link> {t("para comentar.")}
        </p>
      )}

      {atErrado && (
        <p className="comment-aviso">
          {t("Esse momento não se percebe. Escreve 2:05 ou 125.")}
        </p>
      )}

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="muted">{t("A carregar comentários...")}</p>
      ) : comments.length === 0 ? (
        <p className="muted">{t("Ainda sem comentários. Sê o primeiro.")}</p>
      ) : (
        <ul className="comment-list">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              c={c}
              nivel={0}
              user={user}
              onLike={toggleLike}
              onDelete={handleRemove}
              onReply={(id) => setReplyTo(replyTo === id ? null : id)}
              replyTo={replyTo}
              replyBody={replyBody}
              setReplyBody={setReplyBody}
              onSubmitReply={handleSubmitReply}
              onCancelReply={() => setReplyTo(null)}
              busy={busy}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
