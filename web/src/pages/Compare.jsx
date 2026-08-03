import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
function SideCard({ it, label, settings }) {
  const t = displayTitle(it, settings.animeTitleLang === "romaji");
  return (
    <div className={`compare-side ${label === "left" ? "cmp-left" : "cmp-right"}`}>
      <Link to={`/details/${it.type}/${it.tmdbId}`} className="compare-poster-link">
        <div className="compare-poster">
          {imageUrl(it.poster, "w342") ? (
            <img src={imageUrl(it.poster, "w342")} alt={t} loading="lazy" />
          ) : (
            <div className="card-noposter">{t}</div>
          )}
        </div>
      </Link>
      <Link to={`/details/${it.type}/${it.tmdbId}`} className="compare-title">
        {t}
      </Link>
      <div className="compare-ratings">
        <span className="compare-comm">⭐ {fmtRating(it.rating)}</span>
        <span className="compare-mine">
          A tua nota: {it.score != null ? `${it.score}/100` : "—"}
        </span>
      </div>
    </div>
  );
}

// Controlos no meio: nota exata + botões ↑/↓/= para um dos itens.
// A nota é escrita à vontade e guardada quando se sai do campo (blur).
function CenterControls({ it, label, busy, onScore, onAdjust }) {
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
      <span className="cmp-label">{label}</span>
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

export default function Compare() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pair, setPair] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  // Histórico curto de pares já mostrados, para não repetir o mesmo par.
  const avoidRef = useRef(new Set());

  // Só itens marcados como vistos.
  const seen = useMemo(() => items.filter((i) => i.watched), [items]);

  // Chave canónica de um par (independente da ordem esquerda/direita).
  function pairKey(a, b) {
    const ka = `${a.type}:${a.tmdbId}`;
    const kb = `${b.type}:${b.tmdbId}`;
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  }

  // Escolhe um par aleatório que ainda não foi mostrado.
  function pickPair(list) {
    if (list.length < 2) return null;
    const rand = () => list[Math.floor(Math.random() * list.length)];
    let last = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const a = rand();
      let b = rand();
      while (b.tmdbId === a.tmdbId && b.type === a.type) {
        b = rand();
      }
      const k = pairKey(a, b);
      last = [a, b];
      if (!avoidRef.current.has(k)) return [a, b];
    }
    // Todos os pares possíveis já foram vistos: limpa o histórico e devolve um.
    avoidRef.current.clear();
    return last;
  }

  // Carrega a biblioteca do utilizador (itens vistos).
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api
      .library()
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  // Assim que a lista de vistos carrega, gera o primeiro par aleatório.
  useEffect(() => {
    if (seen.length >= 2 && !pair) setPair(pickPair(seen));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen.length, pair]);

  async function saveScore(it, score) {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api.saveLibrary({
        tmdbId: it.tmdbId,
        type: it.type,
        title: it.title,
        poster: it.poster,
        genres: it.genres || [],
        rating: it.rating ?? null,
        score,
      });
      // Atualiza o item em memória para refletir a nova nota.
      setItems((prev) =>
        prev.map((x) =>
          x.tmdbId === it.tmdbId && x.type === it.type ? { ...x, score: d.item.score } : x
        )
      );
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function adjust(it, delta) {
    const cur = it.score ?? 50;
    const next = Math.max(1, Math.min(100, cur + delta));
    await saveScore(it, next);
  }

  function next() {
    // Regista o par corrente no histórico (para não repetir) e avança para um
    // novo par aleatório. Mantém só os 12 últimos para não bloquear definitivamente.
    if (pair) {
      const key = pairKey(pair[0], pair[1]);
      avoidRef.current.add(key);
      if (avoidRef.current.size > 12) {
        const first = avoidRef.current.values().next().value;
        avoidRef.current.delete(first);
      }
    }
    setPair(pickPair(seen));
    setMsg(null);
  }

  if (!user) {
    return (
      <div className="sub-page compare-page">
        <h2 className="row-title">Compara as tuas notas</h2>
        <p className="muted">
          <Link to="/login">Entra</Link> para comparares as notas dos títulos que viste.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="sub-page compare-page">
        <h2 className="row-title">Compara as tuas notas</h2>
        <p className="muted">A carregar a tua lista...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sub-page compare-page">
        <h2 className="row-title">Compara as tuas notas</h2>
        <p className="auth-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="sub-page compare-page">
      <h2 className="row-title">Compara as tuas notas</h2>
      <p className="muted">
        Vês as notas da comunidade de 2 coisas que já viste. No meio podes ajustar a
        tua nota de cada uma: nota exata na caixa, ou ↑/↓/=. Se não escolheres valor,
        sobe/desce de 1 em 1.
      </p>

      {seen.length < 2 ? (
        <p className="muted" style={{ marginTop: 14 }}>
          Ainda não tens pelo menos 2 títulos marcados como vistos. Marca algo
          como visto na ficha do título (ou na "A minha lista") e volta aqui.
        </p>
      ) : pair ? (
        <>
          <div className="compare-row">
            <SideCard it={pair[0]} label="left" settings={settings} />
            <div className="compare-center-col">
              <CenterControls
                it={pair[0]}
                label="Esquerda"
                busy={busy}
                onScore={(s) => saveScore(pair[0], s)}
                onAdjust={(d) => adjust(pair[0], d)}
              />
              <div className="cmp-divider">VS</div>
              <button
                className="cmp-btn cmp-keep cmp-keep-all"
                disabled={busy}
                onClick={next}
                title="Estão bem assim — vai para o próximo par"
              >
                <span className="cmp-ico" aria-hidden="true">=</span>
                <span>Manter e próximo</span>
              </button>
              <div className="cmp-divider">VS</div>
              <CenterControls
                it={pair[1]}
                label="Direita"
                busy={busy}
                onScore={(s) => saveScore(pair[1], s)}
                onAdjust={(d) => adjust(pair[1], d)}
              />
            </div>
            <SideCard it={pair[1]} label="right" settings={settings} />
          </div>
          {msg && <p className="auth-error" style={{ marginTop: 12 }}>{msg}</p>}
          <div className="compare-nav">
            <button className="pick-btn" onClick={next} disabled={busy}>
              Próximo par →
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
