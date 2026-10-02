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
              {it.watched ? <span className="card-watched">✓</span> : null}
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

  useEffect(() => {
    if (!canView) return;
    if (tab === "library" && items === null) {
      api
        .userLibrary(username)
        .then((d) => setItems(d.items || []))
        .catch(() => setItems([]));
    } else if (tab === "lists" && lists === null) {
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
  }, [canView, tab, username, items, lists, people]);

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

  return (
    <div className="sub-page profile-page">
      <header className="profile-head">
        <Avatar avatar={u.avatar} name={u.username} size={84} />
        <div className="profile-info">
          <h2 className="profile-username">{u.username}</h2>
          {u.bio && <p className="profile-bio">{u.bio}</p>}
          <div className="profile-counts">
            <button className="profile-count" onClick={() => switchTab("followers")}>
              <strong>{profile.followers}</strong> seguidores
            </button>
            <button className="profile-count" onClick={() => switchTab("following")}>
              <strong>{profile.following}</strong> a seguir
            </button>
            {!u.isPublic && <span className="profile-private">🔒 Perfil privado</span>}
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
                {profile.isFollowing ? "A seguir ✓" : "Seguir"}
              </button>
            )
          )}
        </div>
      </header>

      <div className="profile-tabs">
        {[
          { id: "library", label: "Biblioteca" },
          { id: "lists", label: "Listas" },
          { id: "followers", label: "Seguidores" },
          { id: "following", label: "A seguir" },
        ].map((t) => (
          <button
            key={t.id}
            className={`tf-chip ${tab === t.id ? "active" : ""}`}
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
