import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import MediaCard from "../components/MediaCard.jsx";
import Manga from "./Manga.jsx";

const TYPES = [
  { id: "movie", label: "Filmes" },
  { id: "tv", label: "Séries" },
  { id: "anime", label: "Anime" },
  { id: "manga", label: "Mangá" },
];

export default function PickForMe() {
  const [type, setType] = useState("anime");
  const [genres, setGenres] = useState([]);
  // estado por género: 1 = quero, 2 = não quero (ausente = indiferente)
  const [picks, setPicks] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const isManga = type === "manga";

  // Carrega os géneros quando muda o tipo (e limpa as escolhas). O Mangá tem a
  // sua própria interface (recomendador), por isso não usa esta grelha.
  useEffect(() => {
    setGenres([]);
    setPicks({});
    setResult(null);
    setMsg(null);
    if (isManga) return;
    api
      .genres(type)
      .then((d) => setGenres(d.genres || []))
      .catch(() => setGenres([]));
  }, [type, isManga]);

  // Clicar num género cicla: indiferente -> quero -> não quero -> indiferente.
  function cycle(id) {
    setPicks((p) => {
      const cur = p[id] || 0;
      const next = (cur + 1) % 3;
      const copy = { ...p };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  async function pick() {
    setLoading(true);
    setMsg(null);
    setResult(null);
    const include = Object.keys(picks).filter((id) => picks[id] === 1);
    const exclude = Object.keys(picks).filter((id) => picks[id] === 2);
    try {
      const d = await api.pick({
        type,
        genres: include.join(","),
        exclude: exclude.join(","),
      });
      if (d.item) setResult(d.item);
      else setMsg("Nada encontrado com esses filtros. Tira alguns e tenta de novo.");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sub-page pick-page">
      <h2 className="row-title">Escolhe algo para mim</h2>

      <div className="lib-filters" style={{ marginTop: 14 }}>
        {TYPES.map((t) => (
          <button
            key={t.id}
            className={`tf-chip ${type === t.id ? "active" : ""}`}
            onClick={() => setType(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isManga ? (
        <Manga embedded />
      ) : (
        <>
          <p className="muted" style={{ marginTop: 14 }}>
            Toca nos géneros: 1x = <b className="want">quero</b>, 2x ={" "}
            <b className="avoid">não quero</b>. Depois carrega no botao.
          </p>

          <div className="genre-grid">
            {genres.map((g) => {
              const st = picks[g.id] || 0;
              return (
                <button
                  key={g.id}
                  className={`genre-chip ${st === 1 ? "want" : ""} ${st === 2 ? "avoid" : ""}`}
                  onClick={() => cycle(g.id)}
                >
                  {st === 1 ? "+ " : st === 2 ? "− " : ""}
                  {g.name}
                </button>
              );
            })}
            {!genres.length && <p className="muted">A carregar géneros...</p>}
          </div>

          <button className="pick-btn" onClick={pick} disabled={loading}>
            {loading ? "A escolher..." : "🎲 Escolhe algo para mim"}
          </button>

          {msg && (
            <p className="muted" style={{ marginTop: 16 }}>
              {msg}
            </p>
          )}

          {result && (
            <div className="pick-result">
              <h3 className="row-title">A tua escolha</h3>
              <div className="pick-result-row">
                <MediaCard item={result} />
                <button className="set-choice" onClick={pick}>
                  Escolhe outra
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
