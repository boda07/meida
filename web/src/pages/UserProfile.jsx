// Perfil de um utilizador: cabeçalho com avatar/bio, botão de seguir e as
// abas Biblioteca / Listas / Seguidores / A seguir.
//
// Privacidade: se o perfil for privado e eu não for o dono, a API esconde a
// biblioteca/listas (canView=false) e mostramos um aviso.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, imageUrl } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useSettings } from "../settings/SettingsContext.jsx";
import Avatar from "../components/Avatar.jsx";
import LoadingStatus from "../components/LoadingStatus.jsx";
import { CheckIcon } from "../components/icons.jsx";
import ProfileStats from "../components/ProfileStats.jsx";
import { statsFrom } from "../components/profileStats.js";

// Título a mostrar: para anime respeita a opção ingles/romaji guardada no servidor.
function displayTitle(it, romaji) {
  if (it.type === "anime") {
    return romaji ? it.titleRomaji || it.title : it.titleEn || it.title;
  }
  return it.title;
}

function PosterGrid({ items, empty, romaji }) {
  if (!items) return <p className="muted">A carregar...</p>;
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <div className="grid">
      {items.map((it) => {
        const t = displayTitle(it, romaji);
        return (
          <Link
            key={`${it.type}-${it.tmdbId}`}
            to={`/details/${it.type}/${it.tmdbId}`}
            className="card card-portrait"
          >
            <div className="card-poster">
              {imageUrl(it.poster, "w342") ? (
                <img src={imageUrl(it.poster, "w342")} alt={t} loading="lazy" />
              ) : (
                <div className="card-noposter">{t}</div>
              )}
              <div className="card-scrim" />
              {it.score ? <span className="card-rating">{it.score}/100</span> : null}
              {it.watched ? (
                <span className="card-watched" title="Visto">
                  <CheckIcon />
                </span>
              ) : null}
              {it.watchlist && !it.watched ? <span className="card-watchlist">+</span> : null}
              <div className="card-footer">
                <h3 className="card-title">{t}</h3>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function UserProfile() {
  const { username } = useParams();
  const { user } = useAuth();
  const { settings } = useSettings();
  const romaji = settings.animeTitleLang === "romaji";
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("library");
  const [items, setItems] = useState(null);
  const [lists, setLists] = useState(null);
  const [openList, setOpenList] = useState(null);
  const [openListItems, setOpenListItems] = useState(null);
  const [people, setPeople] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setProfile(null);
    setItems(null);
    setLists(null);
    setPeople(null);
    setOpenList(null);
    setOpenListItems(null);
    setTab("library");
    api
      .userProfile(username)
      .then((d) => alive && setProfile(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [username]);

  const canView = Boolean(profile?.canView);

  // A biblioteca carrega sempre que se pode ver, e nao so quando a aba
  // "Biblioteca" esta' activa: e' dela que saem a capa e os numeros, e esses
  // fazem parte da identidade do perfil. Se so carregasse com a aba, abrir o
  // perfil em "Seguidores" mostraria um perfil sem capa nem numeros.
  useEffect(() => {
    if (!canView || items !== null) return;
    api
      .userLibrary(username)
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]));
  }, [canView, username, items]);

  // O resto das abas carrega so quando pedidas.
  useEffect(() => {
    if (!canView) return;
    if (tab === "lists" && lists === null) {
      api
        .userLists(username)
        .then((d) => setLists(d.lists || []))
        .catch(() => setLists([]));
    } else if ((tab === "followers" || tab === "following") && people === null) {
      const fn = tab === "followers" ? api.userFollowers : api.userFollowing;
      fn(username)
        .then((d) => setPeople(d.users || []))
        .catch(() => setPeople([]));
    }
  }, [canView, tab, username, lists, people]);

  async function toggleFollow() {
    if (!user || !profile) return;
    setBusy(true);
    try {
      const d = profile.isFollowing
        ? await api.unfollow(profile.user.id)
        : await api.follow(profile.user.id);
      setProfile((p) => ({
        ...p,
        isFollowing: d.isFollowing,
        followers: d.followers ?? p.followers,
      }));
    } catch {
      /* ignora */
    } finally {
      setBusy(false);
    }
  }

  function switchTab(id) {
    setTab(id);
    if (id === "followers" || id === "following") setPeople(null);
  }

  async function showList(id) {
    setOpenList(id);
    setOpenListItems(null);
    try {
      const d = await api.userList(username, id);
      setOpenListItems(d.list?.items || []);
    } catch {
      setOpenListItems([]);
    }
  }

  if (loading) return <LoadingStatus>A carregar o perfil</LoadingStatus>;
  if (error) return <p className="status error">{error}</p>;
  if (!profile) return null;

  const u = profile.user;
  const isMe = profile.isMe;
  // As estatisticas so fazem sentido com a biblioteca carregada. Durante o
  // carregamento a zona dos numeros nao aparece: mostrar zeros que a seguir
  // seriam numeros reais e' pior do que nao mostrar nada.
  const stats = items === null ? null : statsFrom(items);
  // Num perfil privado visto por outra pessoa a biblioteca nao vem, e por isso
  // nao ha capa nem numeros. Mostrar "0 titulos" seria mentira: o perfil pode
  // ter muitos, e so que aquele utilizador nao os pode ver.
  const temDados = items !== null && items.length > 0;

  return (
    <div className="sub-page profile-page">
      {/* Identidade: avatar, nome, bio e accoes. Sem capa e sem sobreposicoes,
          ver o comentario no CSS. */}
      <header className="profile-header">
        <Avatar avatar={u.avatar} name={u.username} size={76} />
        <div className="profile-id">
          <h2 className="profile-username">{u.username}</h2>
          {u.bio && <p className="profile-bio">{u.bio}</p>}
          <div className="profile-social">
            <button className="profile-social-link" onClick={() => switchTab("followers")}>
              {profile.followers} seguidores
            </button>
            <button className="profile-social-link" onClick={() => switchTab("following")}>
              {profile.following} a seguir
            </button>
            {!u.isPublic && <span className="profile-private">Perfil privado</span>}
          </div>
        </div>
        <div className="profile-actions">
          {isMe ? (
            <Link className="modal-btn ghost" to="/settings">
              Editar perfil
            </Link>
          ) : (
            user && (
              <button
                className={`modal-btn ${profile.isFollowing ? "ghost" : ""}`}
                onClick={toggleFollow}
                disabled={busy}
              >
                {profile.isFollowing ? "A seguir" : "Seguir"}
              </button>
            )
          )}
        </div>
      </header>

      {/* Números: quantos títulos, quantos vistos, quantos por ver, e a média das
          notas. São texto, não cartões — o número grande carrega o peso e o
          rótulo pequeno diz o que é. */}
      {stats && temDados && (
        <dl className="profile-stats">
          <div className="profile-stat">
            <dt>títulos</dt>
            <dd>{stats.total}</dd>
          </div>
          <div className="profile-stat">
            <dt>vistos</dt>
            <dd>{stats.vistos}</dd>
          </div>
          <div className="profile-stat">
            <dt>a ver</dt>
            <dd>{stats.aVer}</dd>
          </div>
          {stats.media !== null && (
            <div className="profile-stat">
              <dt>média</dt>
              <dd>{stats.media}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="profile-tabs" role="tablist">
        {[
          { id: "library", label: "Biblioteca" },
          { id: "lists", label: "Listas" },
          { id: "stats", label: "Estatísticas" },
          { id: "followers", label: "Seguidores" },
          { id: "following", label: "A seguir" },
        ].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`profile-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!canView ? (
        <p className="muted profile-locked">
          🔒 Este perfil é privado.{" "}
          {user ? "Segue o utilizador, mas a biblioteca só ele a vê." : "Entra para o adicionares."}
        </p>
      ) : tab === "library" ? (
        <PosterGrid items={items} empty="A biblioteca está vazia." romaji={romaji} />
      ) : tab === "stats" ? (
        <ProfileStats items={items} />
      ) : tab === "lists" ? (
        <div className="profile-lists">
          {lists === null ? (
            <p className="muted">A carregar...</p>
          ) : lists.length === 0 ? (
            <p className="muted">Ainda sem listas.</p>
          ) : (
            <div className="profile-list-chips">
              {lists.map((l) => (
                <button
                  key={l.id}
                  className={`tf-chip ${openList === l.id ? "active" : ""}`}
                  onClick={() => showList(l.id)}
                >
                  {l.name} <span className="muted">{l.count}</span>
                </button>
              ))}
            </div>
          )}
          {openList != null && (
            <PosterGrid items={openListItems} empty="Esta lista está vazia." romaji={romaji} />
          )}
        </div>
      ) : (
        <div className="profile-people">
          {people === null ? (
            <p className="muted">A carregar...</p>
          ) : people.length === 0 ? (
            <p className="muted">Ninguém por aqui.</p>
          ) : (
            <ul className="people-list">
              {people.map((p) => (
                <li key={p.id} className="people-row">
                  <Link to={`/u/${encodeURIComponent(p.username)}`} className="people-link">
                    <Avatar avatar={p.avatar} name={p.username} size={40} />
                    <span>{p.username}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
