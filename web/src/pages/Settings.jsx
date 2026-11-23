import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useT } from "../i18n/I18nContext.jsx";
import { NOMES_IDIOMA } from "../i18n/traducoes.js";
import { settingsTabStore } from "../storage/settingsTab.js";
import Avatar, { AVATAR_EMOJIS } from "../components/Avatar.jsx";
import { clearPresence, presenceSupported } from "../discord.js";
import {
  ACCENT_PRESETS,
  BG_PRESETS,
  addRecent,
  imageFileToDataUrl,
} from "../settings/aparencia.js";
import ColorField from "../settings/ColorField.jsx";
import Choice from "../settings/Choice.jsx";
import { TABS } from "../settings/abas.js";
import MalSection from "../settings/contas/MalSection.jsx";
import AniListSection from "../settings/contas/AniListSection.jsx";
import LetterboxdSection from "../settings/contas/LetterboxdSection.jsx";
import DebridSection from "../settings/contas/DebridSection.jsx";
import { usePerfil } from "../settings/usePerfil.js";
import { useServidor } from "../settings/useServidor.js";
import { useDados } from "../settings/useDados.js";
import { useAtualizacao } from "../settings/useAtualizacao.js";
import { useEstadoProviders } from "../settings/useEstadoProviders.js";

export default function Settings() {
  const { settings, update, erroGuardar, avisoAcento } = useSettings();
  const t = useT();
  const {
    user,
    imgUrl,
    setImgUrl,
    bio,
    setBio,
    isPublic,
    setIsPublic,
    saving,
    error,
    pickAvatar,
    pickAvatarFicheiro,
    saveProfile,
    profileSaving,
    profileMsg,
  } = usePerfil();
  const {
    desktop,
    srv,
    srvMode,
    setSrvMode,
    srvUrl,
    setSrvUrl,
    srvBusy,
    srvMsg,
    srvErr,
    saveServer,
  } = useServidor();
  const { updMsg, updBusy, checkUpdate } = useAtualizacao();
  const { provHealth, reverAgora } = useEstadoProviders();
  const {
    exporting,
    exportMsg,
    exportData,
    importFile,
    importing,
    importMsg,
    importError,
    onImportPick,
    runImport,
  } = useDados();

  // Aba activa. Guardada no browser para não voltar ao "Perfil" a cada visita
  // (e para não perder o scroll de quem só anda a ver as contas linked).
  const [tab, setTab] = useState(() => {
    try {
      const saved = settingsTabStore.get();
      return TABS.some((t) => t.id === saved) ? saved : "perfil";
    } catch {
      return "perfil";
    }
  });

  // Persiste a aba activa.
  useEffect(() => {
    settingsTabStore.set(tab);
  }, [tab]);

  // Mudar as sinopses nao deve arrastar os generos: se estes estao a seguir as
  // sinopses (genreLang vazio), fixa-os no idioma antigo ao trocar as sinopses.
  function pickOverview(value) {
    const patch = { overviewLang: value };
    if (value !== settings.overviewLang && !settings.genreLang) {
      patch.genreLang = settings.overviewLang;
    }
    update(patch);
  }

  return (
    <div className="sub-page settings-page" data-active-tab={tab}>
      <h2 className="row-title">{t("Definições")}</h2>

      {/* Abas: uma secção de cada vez, para não teres de rolar a página toda. */}
      <nav className="mode-tabs settings-tabs" role="tablist" aria-label={t("Secções das definições")}>
        {/* A variavel chama-se `tabDef` e nao `t`: `t` ja e' a funcao de traducao
            (do `useT()`), e um `t` dentro do map a tapava. */}
        {TABS.map((tabDef) => (
          <button
            key={tabDef.id}
            type="button"
            role="tab"
            aria-selected={tab === tabDef.id}
            className={tab === tabDef.id ? "active" : ""}
            onClick={() => setTab(tabDef.id)}
          >
            {t(tabDef.label)}
          </button>
        ))}
      </nav>

      {/* ===== Servidor (so no desktop Electron) ===== */}
      {desktop?.getServerConfig && (
        <section className="set-section" data-tab="dados">
          <h3>{t("Servidor")}</h3>
          <p className="muted">
            {t("Onde ficam os teus dados. {a} guarda tudo localmente.", {
              a: <strong>{t("Este computador")}</strong>,
            })}{" "}
            {t("{a} liga a app a um MEIDA alojado noutro sítio, para partilhares conta, biblioteca, seguidores e comentários entre dispositivos.", {
              a: <strong>{t("Servidor remoto")}</strong>,
            })}
          </p>
          {srv && !srv.packaged && (
            <p className="muted">
              {t("Estás em desenvolvimento — esta opção só se aplica à app instalada.")}
            </p>
          )}
          <div className="set-row set-server-row">
            <button
              className={`set-server-choice ${srvMode === "local" ? "active" : ""}`}
              onClick={() => setSrvMode("local")}
            >
              {t("Este computador")}
            </button>
            <button
              className={`set-server-choice ${srvMode === "remote" ? "active" : ""}`}
              onClick={() => setSrvMode("remote")}
            >
              {t("Servidor remoto")}
            </button>
          </div>
          {srvMode === "remote" && (
            <label className="set-field">
              <span>{t("Endereço do servidor")}</span>
              <input
                className="set-text"
                type="url"
                inputMode="url"
                placeholder="https://meida.exemplo.com"
                value={srvUrl}
                onChange={(e) => setSrvUrl(e.target.value)}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </label>
          )}
          <button className="lib-watched" onClick={saveServer} disabled={srvBusy}>
            {srvBusy ? t("A guardar...") : t("Guardar e reiniciar")}
          </button>
          {srv && (
            <p className="muted">
              {t("A ligar a: {destino}", {
                destino: (
                  <strong>
                    {srv.mode === "remote" && srv.url
                      ? srv.url
                      : t("servidor local deste computador")}
                  </strong>
                ),
              })}
            </p>
          )}
          {srvMsg && <p className={srvErr ? "status error" : "muted"}>{srvMsg}</p>}
          <p className="muted">
            {t("O servidor remoto tem de correr o MEIDA com a web incluída (ex.: {cmd}).", { cmd: "npm run start:pwa" })}
          </p>
        </section>
      )}

      {/* ===== Idiomas ===== */}
      {/* O idioma da INTERFACE, que e' uma coisa diferente do idioma dos
          titulos (o de baixo). Este e' o que traduz os botoes e os menus; aquele
          so' muda "Inception" -> "A Origem" no catalogo.
          Fica em primeiro porque e' o que torna a app legivel para quem nao
          fala portugues. */}
      <section className="set-section" data-tab="conteudo">
        <h3>{t("Idioma da interface")}</h3>
        <p className="muted">{t("A lingua dos botoes, menus e textos da app.")}</p>
        <div className="set-row">
          {t.linguas.map((l) => (
            <Choice key={l} value={l} current={t.idioma} onPick={t.mudarIdioma}>
              {NOMES_IDIOMA[l]}
            </Choice>
          ))}
        </div>
      </section>

      <section className="set-section" data-tab="conteudo">
        <h3>{t("Títulos")}</h3>
        <p className="muted">{t("Idioma dos nomes de filmes, séries e anime.")}</p>
        <div className="set-row">
          {/* A primeira opcao e' "auto": o titulo segue o idioma da interface.
              Sem ela, o idioma da interface e o dos titulos sao duas definicoes
              e quem so muda a primeira nao nota nada nos titulos. */}
          <Choice value="auto" current={settings.titleLang} onPick={(v) => update({ titleLang: v })}>
            {t("Igual à interface")}
          </Choice>
          <Choice value="pt" current={settings.titleLang} onPick={(v) => update({ titleLang: v })}>
            {t("Português")}
          </Choice>
          <Choice value="en" current={settings.titleLang} onPick={(v) => update({ titleLang: v })}>
            {t("Inglês")}
          </Choice>
        </div>
      </section>

      <section className="set-section" data-tab="conteudo">
        <h3>{t("Sinopses")}</h3>
        <p className="muted">{t("Idioma das descrições/sinopses.")}</p>
        <div className="set-row">
          <Choice value="pt" current={settings.overviewLang} onPick={pickOverview}>
            {t("Português")}
          </Choice>
          <Choice value="en" current={settings.overviewLang} onPick={pickOverview}>
            {t("Inglês")}
          </Choice>
        </div>
      </section>

      <section className="set-section" data-tab="conteudo">
        <h3>{t("Géneros")}</h3>
        <p className="muted">{t("Idioma dos géneros e temas (na tua lista, filtros e detalhes).")}</p>
        <div className="set-row">
          <Choice
            value="pt"
            current={settings.genreLang || settings.overviewLang}
            onPick={(v) => update({ genreLang: v })}
          >
            {t("Português")}
          </Choice>
          <Choice
            value="en"
            current={settings.genreLang || settings.overviewLang}
            onPick={(v) => update({ genreLang: v })}
          >
            {t("Inglês")}
          </Choice>
        </div>
      </section>

      <section className="set-section" data-tab="reproducao">
        <h3>{t("Legendas")}</h3>
        <p className="muted">
          {t("Legenda preferida (ativada automaticamente nos players sem anúncios e de torrents).")}
        </p>
        <div className="set-row">
          <Choice value="pt" current={settings.subtitleLang} onPick={(v) => update({ subtitleLang: v })}>
            {t("Português")}
          </Choice>
          <Choice value="en" current={settings.subtitleLang} onPick={(v) => update({ subtitleLang: v })}>
            {t("Inglês")}
          </Choice>
          <Choice value="off" current={settings.subtitleLang} onPick={(v) => update({ subtitleLang: v })}>
            {t("Desligadas")}
          </Choice>
        </div>
      </section>

      <section className="set-section" data-tab="reproducao">
        <h3>{t("Anime: áudio")}</h3>
        <p className="muted">
          {t("Legendado (sub) ou dobrado (dub). Aplica-se às fontes dedicadas de anime (MegaPlay/VidLink/VidSrc.cc por MyAnimeList).")}
        </p>
        <div className="set-row">
          <Choice value="sub" current={settings.animeAudio} onPick={(v) => update({ animeAudio: v })}>
            Sub (legendado)
          </Choice>
          <Choice value="dub" current={settings.animeAudio} onPick={(v) => update({ animeAudio: v })}>
            Dub (dobrado)
          </Choice>
        </div>
      </section>

      <section className="set-section" data-tab="conteudo">
        <h3>{t("Anime: títulos")}</h3>
        <p className="muted">
          {t("Como mostrar os nomes dos animes (catálogo, pesquisa e a tua lista).")}
        </p>
        <div className="set-row">
          <Choice value="en" current={settings.animeTitleLang} onPick={(v) => update({ animeTitleLang: v })}>
            {t("Inglês")}
          </Choice>
          <Choice value="romaji" current={settings.animeTitleLang} onPick={(v) => update({ animeTitleLang: v })}>
            {t("Romaji")}
          </Choice>
        </div>
      </section>

      <section className="set-section" data-tab="conteudo">
        <h3>{t("Conteúdo adulto (anime)")}</h3>
        <p className="muted">
          {t('Mostrar anime adulto (NSFW/hentai) na pesquisa, nos filtros de género e no "Escolhe algo para mim". Desligado por defeito.')}
        </p>
        <div className="set-row">
          <Choice value={false} current={settings.showAdult} onPick={(v) => update({ showAdult: v })}>
            {t("Esconder")}
          </Choice>
          <Choice value={true} current={settings.showAdult} onPick={(v) => update({ showAdult: v })}>
            {t("Mostrar")}
          </Choice>
        </div>
      </section>

      <section className="set-section" data-tab="reproducao">
        <h3>{t("Separador inicial")}</h3>
        <p className="muted">{t("Onde abrir por defeito ao ver um título.")}</p>
        <div className="set-row">
          <Choice value="providers" current={settings.defaultTab} onPick={(v) => update({ defaultTab: v })}>
            {t("Providers")}
          </Choice>
          <Choice value="extract" current={settings.defaultTab} onPick={(v) => update({ defaultTab: v })}>
            {t("Sem anúncios")}
          </Choice>
          <Choice value="torrents" current={settings.defaultTab} onPick={(v) => update({ defaultTab: v })}>
            {t("Torrents")}
          </Choice>
        </div>
      </section>

      {/* ===== Reprodução ===== */}
      <section className="set-section" data-tab="reproducao">
        <h3>{t("Reprodução")}</h3>
        <p className="muted">
          {t("Autoplay liga/desliga o arranque automático. Autoskip tenta saltar a intro/genéricos (funciona nos nossos players; nos providers externos depende do site).")}
        </p>
        <div className="set-row">
          <Choice value={true} current={settings.autoplay} onPick={(v) => update({ autoplay: v })}>
            {t("Autoplay ligado")}
          </Choice>
          <Choice value={false} current={settings.autoplay} onPick={(v) => update({ autoplay: v })}>
            {t("Autoplay desligado")}
          </Choice>
        </div>
        <div className="set-row" style={{ marginTop: 8 }}>
          <Choice value={true} current={settings.autoskip} onPick={(v) => update({ autoskip: v })}>
            {t("Autoskip ligado")}
          </Choice>
          <Choice value={false} current={settings.autoskip} onPick={(v) => update({ autoskip: v })}>
            {t("Autoskip desligado")}
          </Choice>
        </div>
      </section>

      {/* ===== Tamanho dos cartazes ===== */}
      <section className="set-section" data-tab="aparencia">
        <h3>{t("Tamanho dos cartazes")}</h3>
        <p className="muted">
          {t("Ajusta a largura e a altura dos posters (útil em ecrãs pequenos).")}
        </p>
        <div className="set-slider">
          <label>
            <span>{t("Largura")}</span>
            <b>{settings.cardW || 184}px</b>
          </label>
          <input
            type="range"
            min="110"
            max="280"
            step="2"
            value={settings.cardW || 184}
            onChange={(e) => update({ cardW: Number(e.target.value) })}
          />
        </div>
        <div className="set-slider">
          <label>
            <span>{t("Altura")}</span>
            <b>{settings.cardH || 272}px</b>
          </label>
          <input
            type="range"
            min="150"
            max="420"
            step="2"
            value={settings.cardH || 272}
            onChange={(e) => update({ cardH: Number(e.target.value) })}
          />
        </div>
        <button
          className="set-clear"
          onClick={() => update({ cardW: 184, cardH: 272 })}
        >
          {t("Repor tamanho")}
        </button>
      </section>

      {/* ===== Cor da UI ===== */}
      <section className="set-section" data-tab="aparencia">
        <h3>{t("Cor de destaque")}</h3>
        <p className="muted">
          {t("Cor dos botões e realces. Predefinidas, as tuas últimas escolhas, ou o picker.")}
        </p>
        <ColorField
          presets={ACCENT_PRESETS}
          value={settings.accent}
          recent={settings.recentAccent}
          fallback="#c90303"
          onPick={(v) => update({ accent: v })}
          onCommit={(v) => update({ recentAccent: addRecent(settings.recentAccent, v) })}
        />
        {avisoAcento && (
          <p className="vhint vhint-erro" role="alert">
            {t("A cor de destaque escolhida tem pouco contraste sobre o fundo ({ratio}:1). O texto em destaque pode ser dificil de ler — escolha uma cor mais clara.", {
              ratio: avisoAcento.ratio,
            })}
          </p>
        )}
      </section>

      {/* ===== Cor de fundo ===== */}
      <section className="set-section" data-tab="aparencia">
        <h3>{t("Cor de fundo")}</h3>
        <p className="muted">
          {t("Fundo da app. Predefinidas (escuras, texto legível), as tuas últimas escolhas, ou o picker.")}
        </p>
        <ColorField
          presets={BG_PRESETS}
          value={settings.bgColor}
          recent={settings.recentBg}
          fallback="#070708"
          onPick={(v) => update({ bgColor: v })}
          onCommit={(v) => update({ recentBg: addRecent(settings.recentBg, v) })}
        />
      </section>

      {/* ===== Estilo de fundo ===== */}
      <section className="set-section" data-tab="aparencia">
        <h3>{t("Estilo de fundo")}</h3>
        <p className="muted">
          {t("Simples (só a cor), um padrão por cima, ou uma imagem tua (como o fundo do WhatsApp). O padrão usa a tua cor de destaque.")}
        </p>
        <div className="set-row">
          {[
            { id: "none", label: "Simples" },
            { id: "glow", label: "Brilho" },
            { id: "aurora", label: "Aurora" },
            { id: "mesh", label: "Malha" },
            { id: "dots", label: "Pontos" },
            { id: "grid", label: "Grelha" },
            { id: "image", label: "Imagem" },
          ].map((o) => (
            <Choice
              key={o.id}
              value={o.id}
              current={settings.bgStyle || "none"}
              onPick={(v) => update({ bgStyle: v })}
            >
              {t(o.label)}
            </Choice>
          ))}
        </div>
        {erroGuardar && (
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 12,
              color: "#ffb4a2",
              borderLeft: "3px solid #ff6a3d",
              paddingLeft: 8,
            }}
          >
            {erroGuardar}
          </p>
        )}
        {settings.bgStyle === "image" && (
          <div style={{ marginTop: 12 }}>
            {!settings.bgImage && (
              <p className="muted" style={{ margin: "0 0 10px", fontSize: 12 }}>
                {t(
                  "Escolhe uma imagem para o fundo. Sem imagem, o fundo fica so com a cor escura e parece que a app esta preta."
                )}
              </p>
            )}
            <div className="set-img-url">
              <input
                className="set-input"
                type="text"
                placeholder={t("Cola o URL de uma imagem (https://...)")}
                value={settings.bgImage?.startsWith("data:") ? "" : settings.bgImage || ""}
                onChange={(e) => update({ bgImage: e.target.value.trim() })}
              />
              <label className="lib-watched" style={{ cursor: "pointer" }}>
                {t("Escolher do PC")}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      try {
                        update({ bgImage: await imageFileToDataUrl(f) });
                      } catch {
                        /* imagem invalida -> ignora */
                      }
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {settings.bgImage && (
              <div className="set-bg-preview-row">
                <div
                  className="set-bg-preview"
                  style={{ backgroundImage: `url("${settings.bgImage}")` }}
                />
                <span className="muted" style={{ fontSize: 12 }}>
                  {settings.bgImage.startsWith("data:")
                    ? t("Imagem do computador")
                    : t("Imagem por URL")}
                </span>
                <button className="set-clear" onClick={() => update({ bgImage: "" })}>
                  {t("Remover imagem")}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ===== MyAnimeList ===== */}
      <section className="set-section" data-tab="contas">
        <h3>{t("MyAnimeList")}</h3>
        <MalSection user={user} />
      </section>

      {/* ===== AniList ===== */}
      <section className="set-section" data-tab="contas">
        <h3>{t("AniList")}</h3>
        <AniListSection user={user} />
      </section>

      {/* ===== Os teus dados ===== */}
      <section className="set-section" data-tab="dados">
        <h3>{t("Os teus dados")}</h3>
        <p className="muted">
          {t("Descarrega a tua biblioteca e diário. Em JSON (para fazer backup ou voltar a usar depois) ou CSV (para abrir no Excel/Sheets).")}
        </p>
        <div className="set-row">
          <button
            className="set-choice"
            onClick={() => exportData("json")}
            disabled={exporting !== null}
          >
            {exporting === "json" ? t("A exportar...") : "Exportar JSON"}
          </button>
          <button
            className="set-choice"
            onClick={() => exportData("csv")}
            disabled={exporting !== null}
          >
            {exporting === "csv" ? t("A exportar...") : "Exportar CSV"}
          </button>
        </div>
        {exportMsg && <span className="muted" style={{ display: "block", marginTop: 8 }}>{exportMsg}</span>}
      </section>

      {/* ===== Discord ===== */}
      <section className="set-section" data-tab="dados">
        <h3>{t("Discord")}</h3>
        <p className="muted">
          {t("Aparece ao lado do teu nome no Discord o que estás a ver, como no Stremio. Só funciona com a app do Discord aberta neste computador, e nada é enviado para a internet — a MEIDA escreve directamente no Discord do teu PC.")}
        </p>
        {presenceSupported() ? (
          <label className="set-toggle">
            <input
              type="checkbox"
              checked={settings.discordPresence !== false}
              onChange={(e) => {
                update({ discordPresence: e.target.checked });
                // Desligar deve esconder o que já estava a aparecer.
                if (!e.target.checked) clearPresence();
              }}
            />
            <span>{t("Mostrar no Discord o que estou a ver")}</span>
          </label>
        ) : (
          <p className="muted">
            {t("Isto só funciona na app de computador (Electron), não na versão web.")}
          </p>
        )}
      </section>

      {/* ===== Importar dados ===== */}
      <section className="set-section" data-tab="dados">
        <h3>{t("Importar dados")}</h3>
        <p className="muted">
          {t("Carrega um ficheiro JSON ou CSV exportado da MEIDA para voltar a carregar a tua biblioteca e diário. É um merge: não apaga notas nem visto que o ficheiro não traga.")}
        </p>
        <div className="set-row">
          <label className="lib-watched" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
              <polyline points="18 1 11 8 13 8 13 22 18 22 18 8 21 8 18 1 18 1" />
            </svg>
            {t("Escolher ficheiro")}
            <input
              type="file"
              accept=".json,.csv,text/csv,text/anytext,.bak"
              style={{ display: "none" }}
              onChange={onImportPick}
            />
          </label>
          <span className="muted" style={{ fontSize: 12 }}>
            {importFile ? importFile.name : t("Sem ficheiro")}
          </span>
        </div>
        {importFile && (
          <button className="set-choice" onClick={runImport} disabled={importing}>
            {importing ? t("A importar...") : "Importar"}
          </button>
        )}
        {importMsg && <span className={`muted ${importError ? "auth-error" : ""}`}>{importMsg}</span>}
        {/* Atalho para o mesmo assistente de sempre, aqui no sitio onde se vai
            buscar a segunda vez. **E' o caminho que o `deveMostrar` nao da'**:
            quem ja tem titulos nunca ve o wizard sozinho, e sem esta botao o
            assistente so existia no primeiro minuto de vida de uma conta.

            `window.abrirOnboarding` e' registado pelo `App.jsx` e **desligado
            logo** (`onFechar` volta a por `false`): se ficasse ligado, este
            botao abriria o wizard em todas as navegacoes seguintes. */}
        <div className="set-row">
          <button
            className="set-choice"
            onClick={() => {
              if (typeof window !== "undefined" && window.abrirOnboarding) {
                window.abrirOnboarding();
              }
            }}
          >
            {t("Assistente de importação")}
          </button>
        </div>
      </section>

      {/* ===== Letterboxd ===== */}
      <section className="set-section" data-tab="contas">
        <h3>{t("Letterboxd")}</h3>
        <LetterboxdSection user={user} />
      </section>

      {/* ===== Real-Debrid ===== */}
      <section className="set-section" data-tab="contas">
        <h3>{t("Real-Debrid")}</h3>
        <DebridSection user={user} />
      </section>

      {/* ===== Perfil público ===== */}
      <section className="set-section" data-tab="perfil">
        <h3>{t("Perfil")}</h3>
        {!user ? (
          <p className="muted">
            <Link to="/login">{t("Entra")}</Link> {t("para editares o teu perfil.")}
          </p>
        ) : (
          <>
            <p className="muted">
              {t("É o que os outros veem quando visitam o teu perfil. A biblioteca e as listas só aparecem se o perfil estiver público.")}
            </p>
            <label className="set-field">
              <span>{t("Bio")}</span>
              <textarea
                className="set-bio"
                value={bio}
                maxLength={300}
                rows={3}
                placeholder={t("Uma frase sobre os teus gostos...")}
                onChange={(e) => setBio(e.target.value)}
              />
            </label>
            <label className="set-toggle">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <span>
                {t("Perfil público — qualquer pessoa pode ver a tua biblioteca, listas e atividade.{estado}", {
                  estado: !isPublic ? t(" (agora está privado: só tu vês)") : "",
                })}
              </span>
            </label>
            <button
              className="lib-watched"
              onClick={saveProfile}
              disabled={profileSaving}
            >
              {profileSaving ? t("A guardar...") : t("Guardar perfil")}
            </button>
            {profileMsg && <p className="muted">{profileMsg}</p>}
          </>
        )}
      </section>

      {/* ===== Avatar ===== */}
      <section className="set-section" data-tab="perfil">
        <h3>{t("Avatar")}</h3>
        {!user ? (
          <p className="muted">
            <Link to="/login">{t("Entra")}</Link> {t("para escolheres um avatar.")}
          </p>
        ) : (
          <>
            <div className="set-avatar-current">
              <Avatar avatar={user.avatar} name={user.username} size={64} userId={user.id} />
              <span className="muted">{user.username}</span>
            </div>

            <div className="avatar-grid">
              {AVATAR_EMOJIS.map((e) => {
                const val = `emoji:${e}`;
                return (
                  <button
                    key={e}
                    className={`avatar-opt ${user.avatar === val ? "active" : ""}`}
                    onClick={() => pickAvatar(val)}
                    disabled={saving}
                  >
                    {e}
                  </button>
                );
              })}
            </div>

            <div className="set-img-url">
              <input
                type="url"
                placeholder={t("...ou cola o URL de uma imagem (https://...)")}
                value={imgUrl}
                onChange={(e) => setImgUrl(e.target.value)}
              />
              <button
                className="lib-watched"
                onClick={() => pickAvatar(imgUrl)}
                disabled={saving || !imgUrl.trim()}
              >
                {t("Usar URL")}
              </button>
              <label className="lib-watched" style={{ cursor: "pointer" }}>
                {t("Escolher do PC")}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    pickAvatarFicheiro(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {user.avatar && (
              <button
                className="set-clear"
                onClick={() => pickAvatar("")}
                disabled={saving}
              >
                {t("Remover avatar")}
              </button>
            )}
            {error && <p className="auth-error">{error}</p>}
          </>
        )}
      </section>

      {/* ===== Estado dos providers ===== */}
      <section className="set-section" data-tab="avancado">
        <h3>{t("Estado dos providers")}</h3>
        <p className="muted">
          {t("Fontes de stream usadas no player (embeds). Quando um está morto fica riscado e é saltado na escolha automática.")}
        </p>
        {provHealth?.checking && !provHealth?.providers ? (
          <p className="muted">{t("A testar providers...")}</p>
        ) : !provHealth?.providers ? (
          <p className="muted">{t("Sem informação.")}</p>
        ) : (
          <div className="provider-health-list">
            {provHealth.providers.map((p) => (
              <div className="provider-health-row" key={p.id}>
                <span className={p.ok ? "ph-ok" : "ph-dead"}>
                  {p.ok ? "●" : "✕"} {p.name}
                </span>
                {!p.ok && p.error && (
                  // `t()` em volta: o motivo vem do servidor, em portugues, e
                  // sao as razoes que became mais uteis com o probe do nativo
                  // (ver `probeNativo`). Sem traduzir, quem esta' em ingles le
                  // o motivo em portugues — e o `t()` devolve a propria chave
                  // quando nao a conhece, entao os motivos antigos (HTTP 500,
                  // timeout) ficam como estavam.
                  <span className="ph-reason muted">({t(p.error)})</span>
                )}
              </div>
            ))}
          </div>
        )}
        {provHealth?.stale && <span className="ph-stale">{t("Atualizado há 24h+")}</span>}
        <div className="set-row" style={{ marginTop: 8 }}>
          <button className="set-choice" onClick={reverAgora}>
            {t("Rever agora")}
          </button>
        </div>
      </section>

      {/* ===== App (só na app instalada) ===== */}
      {typeof window !== "undefined" && window.electronAPI?.uninstall && (
        <section className="set-section" data-tab="avancado">
          <h3>{t("Atualizações")}</h3>
          <p className="muted">
            {t("Procura uma versão nova da MEIDA. Não precisas de ter conta.")}
          </p>
          <button onClick={checkUpdate} disabled={updBusy}>
            {updBusy ? t("A procurar...") : t("Procurar atualização")}
          </button>
          {updMsg && <p className="muted">{updMsg}</p>}
          <h3 style={{ marginTop: 22 }}>{t("Desinstalar")}</h3>
          <p className="muted">
            {t("Remove a MEIDA do computador. A app fecha e o desinstalador abre.")}
          </p>
          <button
            className="set-clear danger"
            onClick={() => window.electronAPI.uninstall()}
          >
            {t("Desinstalar MEIDA")}
          </button>
        </section>
      )}
    </div>
  );
}