import { useEffect, useMemo, useState } from "react";
import { api, imageUrl } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useSettings } from "../settings/SettingsContext.jsx";

// Título a mostrar: para anime respeita a opção ingles/romaji.
function displayTitle(it, romaji) {
  if (it.type === "anime") {
    return romaji ? it.titleRomaji || it.title : it.titleEn || it.title;
  }
  return it.title;
}

// Nota da comunidade arredondada para 1 casa (ou "—" se não houver).
function fmtRating(r) {
  return r != null ? (Math.round(r * 10) / 10).toLocaleString("pt-PT") : "—";
}

// Cartão lateral: capa, título e notas de um item.
function CompareCard({ it, settings, tag }) {
  const t = displayTitle(it, settings.animeTitleLang === "romaji");
  return (
    <div className="compare-side">
      <div className="compare-poster-link">
        <div className="compare-poster">
          {imageUrl(it.poster, "w342") ? (
            <img src={imageUrl(it.poster, "w342")} alt={t} loading="lazy" />
          ) : (
            <div className="card-noposter">{t}</div>
          )}
        </div>
      </div>
      <div className="compare-title">{t}</div>
      <div className="compare-ratings">
        <span className="compare-comm">⭐ {fmtRating(it.rating)}</span>
        <span className="compare-mine">
          {tag ? `${tag}: ` : ""}
          {it.score != null ? `${it.score}/100` : "—"}
        </span>
      </div>
    </div>
  );
}

// Controlos no meio: nota exata + botões ↑/↓ para ajustar o título atual.
// A nota é escrita à vontade e guardada quando se sai do campo (blur).
function CenterControls({ it, busy, onScore, onAdjust }) {
  const [draft, setDraft] = useState(it.score ?? "");
  useEffect(() => {
    setDraft(it.score ?? "");
  }, [it.tmdbId, it.type, it.score]);

  function commit(v) {
    if (v === "") return;
    const n = Number(v);
    if (Number.isNaN(n)) return;
    onScore(Math.max(1, Math.min(100, Math.round(n))));
  }

  return (
    <div className="compare-center">
      <span className="cmp-label">A tua nota</span>
      <label className="compare-score">
        Nota:
        <input
          type="number"
          min={1}
          max={100}
          value={draft}
          disabled={busy}
          placeholder="1–100"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
        />
      </label>
      <div className="compare-btns">
        <button className="cmp-btn cmp-down" disabled={busy} onClick={() => onAdjust(-1)} title="Baixar 1">
          <span className="cmp-ico" aria-hidden="true">↓</span>
          <span>Baixar</span>
        </button>
        <button className="cmp-btn cmp-up" disabled={busy} onClick={() => onAdjust(1)} title="Subir 1">
          <span className="cmp-ico" aria-hidden="true">↑</span>
          <span>Aumentar</span>
        </button>
      </div>
    </div>
  );
}

// Modal "Comparar avaliação": o título atual fica de um lado (a nota é ajustada
// aqui) e um título que já viste do outro, como referência. Podes trocar a
// referência para continuares a comparar.
export default function CompareRating({ details, onClose }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [items, setItems] = useState([]);
  const [current, setCurrent] = useState(null);
  const [other, setOther] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const seen = useMemo(() => items.filter((i) => i.watched), [items]);
  // Referências: títulos que já viste, excluindo o título atual.
  const refs = useMemo(
    () =>
      seen.filter(
        (i) => !(i.type === details.type && String(i.tmdbId) === String(details.id))
      ),
    [seen, details]
  );

  useEffect(() => {
    if (!user) return;
    api
      .library()
      .then((d) => setItems(d.items || []))
      .catch(() => {});
    api
      .libraryItem(details.type, details.id)
      .then((d) => setCurrent(d.item))
      .catch(() => {});
  }, [user, details.type, details.id]);

  // Sobe uma referência aleatória quando a lista carrega.
  useEffect(() => {
    if (!other && refs.length) {
      setOther(refs[Math.floor(Math.random() * refs.length)]);
    }
  }, [refs, other]);

  const curItem = {
    tmdbId: details.id,
    type: details.type,
    title: details.title,
    poster: details.poster,
    rating: details.rating ?? null,
    genres: details.genres || [],
    score: current?.score ?? null,
  };

  async function saveScore(score) {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api.saveLibrary({
        tmdbId: curItem.tmdbId,
        type: curItem.type,
        title: curItem.title,
        poster: curItem.poster,
        genres: curItem.genres,
        rating: curItem.rating,
        score,
      });
      setCurrent(d.item);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  function adjust(delta) {
    const cur = current?.score ?? 50;
    const next = Math.max(1, Math.min(100, cur + delta));
    saveScore(next);
  }

  function swapRef() {
    const rest = refs.filter(
      (i) => !(i.type === other?.type && String(i.tmdbId) === String(other?.tmdbId))
    );
    if (!rest.length) return;
    setOther(rest[Math.floor(Math.random() * rest.length)]);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal compare-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Comparar avaliação</h3>
          <button className="modal-close" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body compare-modal-body">
          {refs.length === 0 ? (
            <p className="muted">
              Ainda não tens outros títulos marcados como vistos para comparar.
              Marca algo como visto e volta aqui.
            </p>
          ) : other ? (
            <>
              <div className="compare-row">
                <CompareCard it={curItem} settings={settings} tag="Este título" />
                <div className="compare-center-col">
                  <CenterControls
                    it={curItem}
                    busy={busy}
                    onScore={saveScore}
                    onAdjust={adjust}
                  />
                  <div className="cmp-divider">VS</div>
                  <span className="cmp-label cmp-ref-label">Já viste</span>
                  <button
                    className="pick-btn"
                    onClick={swapRef}
                    disabled={busy || refs.length < 2}
                  >
                    Trocar referência ↻
                  </button>
                </div>
                <CompareCard it={other} settings={settings} tag="A tua nota" />
              </div>
              {msg && <p className="auth-error" style={{ marginTop: 12 }}>{msg}</p>}
              <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
                Compara com o que já viste e ajusta a tua nota com ↑/↓ (ou
                escreve-a na caixa). A nota deste título é guardada de imediato.
              </p>
            </>
          ) : (
            <p className="muted">A carregar a tua lista...</p>
          )}
        </div>
      </div>
    </div>
  );
}
