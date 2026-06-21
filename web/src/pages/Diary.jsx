import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, imageUrl } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

const FILTERS = [
  { id: "all", label: "Tudo" },
  { id: "watching", label: "A ver" },
  { id: "finished", label: "Terminados" },
];

function fmt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function resumeLink(it) {
  const q = new URLSearchParams();
  if (it.season != null) q.set("s", it.season);
  if (it.episode != null) q.set("e", it.episode);
  const qs = q.toString();
  return `/details/${it.type}/${it.tmdbId}${qs ? `?${qs}` : ""}`;
}

function pos(it) {
  if (it.type === "movie") return null;
  if (it.season != null) return `T${it.season} · E${it.episode}`;
  return `Ep. ${it.episode}`;
}

export default function Diary() {
  const { user, ready } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api
      .progress()
      .then((d) => setItems(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (ready && !user)
    return (
      <p className="status muted">
        <Link to="/login">Entra</Link> para veres o teu diario.
      </p>
    );
  if (loading) return <p className="status">A carregar o diario...</p>;

  const shown = filter === "all" ? items : items.filter((i) => i.status === filter);

  return (
    <div className="sub-page">
      <div className="lib-header">
        <h2 className="row-title">Diario</h2>
        <div className="lib-toolbar">
          <div className="lib-filters">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`tf-chip ${filter === f.id ? "active" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!shown.length ? (
        <p className="muted">
          Ainda nao ha nada no diario. Abre um filme/serie e comeca a ver.
        </p>
      ) : (
        <div className="diary-list">
          {shown.map((it) => (
            <Link
              key={`${it.type}-${it.tmdbId}`}
              to={resumeLink(it)}
              className="diary-row"
            >
              <div className="diary-poster">
                {imageUrl(it.poster, "w154") ? (
                  <img src={imageUrl(it.poster, "w154")} alt={it.title} loading="lazy" />
                ) : (
                  <div className="card-noposter">{it.title}</div>
                )}
              </div>
              <div className="diary-info">
                <h3 className="diary-title">
                  {it.title}
                  {pos(it) && <span className="diary-pos"> · {pos(it)}</span>}
                </h3>
                <div className="diary-dates">
                  {fmt(it.startedAt) && <span>Comecou: {fmt(it.startedAt)}</span>}
                  {it.status === "finished" && fmt(it.finishedAt) ? (
                    <span>Acabou: {fmt(it.finishedAt)}</span>
                  ) : (
                    <span className="diary-watching">A ver</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
