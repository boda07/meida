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

const isoToInput = (iso) => (iso ? iso.slice(0, 10) : "");
const inputToIso = (v) => (v ? new Date(v + "T12:00:00").toISOString() : null);

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
  const [edit, setEdit] = useState(null); // item em edicao
  const [form, setForm] = useState(null); // { status, started, finished, season, episode }
  const [saving, setSaving] = useState(false);

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

  function openEdit(it) {
    setEdit(it);
    setForm({
      status: it.status || "watching",
      started: isoToInput(it.startedAt),
      finished: isoToInput(it.finishedAt),
      season: it.season ?? "",
      episode: it.episode ?? "",
    });
  }

  async function saveEdit() {
    if (!edit || !form) return;
    setSaving(true);
    const patch = {
      type: edit.type,
      tmdbId: edit.tmdbId,
      status: form.status,
      startedAt: inputToIso(form.started),
      finishedAt: inputToIso(form.finished),
    };
    if (edit.type !== "movie") {
      patch.season = form.season === "" ? null : Number(form.season);
      patch.episode = form.episode === "" ? null : Number(form.episode);
    }
    try {
      const d = await api.progressUpdate(patch);
      setItems((prev) =>
        prev.map((x) =>
          x.type === edit.type && x.tmdbId === edit.tmdbId ? d.item : x
        )
      );
      setEdit(null);
    } catch {
      /* ignora */
    } finally {
      setSaving(false);
    }
  }

  async function remove(it) {
    setItems((prev) => prev.filter((x) => !(x.type === it.type && x.tmdbId === it.tmdbId)));
    api.progressRemove(it.type, it.tmdbId).catch(() => {});
  }

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
            <div key={`${it.type}-${it.tmdbId}`} className="diary-row">
              <Link to={resumeLink(it)} className="diary-main">
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
              <div className="diary-actions">
                <button
                  className="diary-btn"
                  onClick={() => openEdit(it)}
                  title="Editar"
                  aria-label="Editar"
                >
                  ✎
                </button>
                <button
                  className="diary-btn"
                  onClick={() => remove(it)}
                  title="Remover"
                  aria-label="Remover"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && form && (
        <div className="modal-overlay" onClick={() => setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Editar — {edit.title}</h3>
              <button className="modal-close" aria-label="Fechar" onClick={() => setEdit(null)}>
                ✕
              </button>
            </div>
            <div className="diary-form">
              <label>
                Estado
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="watching">A ver</option>
                  <option value="finished">Terminado</option>
                </select>
              </label>
              <label>
                Comecou
                <input
                  type="date"
                  value={form.started}
                  onChange={(e) => setForm({ ...form, started: e.target.value })}
                />
              </label>
              <label>
                Acabou
                <input
                  type="date"
                  value={form.finished}
                  onChange={(e) => setForm({ ...form, finished: e.target.value })}
                />
              </label>
              {edit.type !== "movie" && (
                <div className="diary-form-row">
                  {edit.type === "tv" && (
                    <label>
                      Temporada
                      <input
                        type="number"
                        min="1"
                        value={form.season}
                        onChange={(e) => setForm({ ...form, season: e.target.value })}
                      />
                    </label>
                  )}
                  <label>
                    Episodio
                    <input
                      type="number"
                      min="1"
                      value={form.episode}
                      onChange={(e) => setForm({ ...form, episode: e.target.value })}
                    />
                  </label>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="modal-btn ghost" onClick={() => setEdit(null)}>
                Cancelar
              </button>
              <button className="modal-btn" onClick={saveEdit} disabled={saving}>
                {saving ? "A guardar..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
