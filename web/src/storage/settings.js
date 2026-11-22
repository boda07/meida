// As preferências do utilizador (idiomas, legendas, cores, fundo...).
//
// O valor guardado é um objecto JSON; o `get()` junta-o aos omissões e aplica
// as migrações **uma vez**. Se o JSON estiver corrupto, não se deita tudo fora
// em silêncio: guarda-se uma cópia em `streamapp_settings_aviso` e avisa-se na
// consola — era assim que se perdiam o fundo, o accent e as legendas sem pista.
import { criarStore } from "./criarStore.js";

const SETTINGS_KEY = "streamapp_settings";
// Marca de "a migração do titleLang já correu". Ver `aplicarMigracoes`.
const MIGRACAO_TITULOS_KEY = "streamapp_migrou_titlang";

const store = criarStore(SETTINGS_KEY, { fallback: null });
const aviso = criarStore(SETTINGS_KEY + "_aviso", { json: false });
const migracao = criarStore(MIGRACAO_TITULOS_KEY, { json: false });

export const DEFAULT_SETTINGS = {
  // Idioma dos títulos: "auto" | "pt" | "en".
  //
  // "auto" é o omisso de propósito: o título segue o idioma da interface. Antes
  // era "en", e o efeito era o que o utilizador reportou — escolher português
  // na interface não mexia nos títulos, porque o idioma da interface e o dos
  // títulos são duas definições e só a segunda mandava no catálogo.
  titleLang: "auto",
  overviewLang: "pt", // idioma das sinopses: "en" | "pt"
  genreLang: "", // idioma dos géneros: "en" | "pt" | "" (segue as sinopses)
  animeTitleLang: "en", // títulos de anime: "en" (ingles) | "romaji"
  subtitleLang: "pt", // legenda preferida: "pt" | "en" | "off"
  // Como as legendas se mostram. O delay é em segundos (positivo = atrasa).
  subTamanho: "normal", // "pequeno" | "normal" | "grande" | "muito grande"
  subOpacidade: 1, // 0 (invisivel) a 1 (opaca)
  subFonte: "", // "" (a do sistema) | "sistema" | "serifada" | "monoespacada"
  subDelay: 0, // -10 a +10 segundos
  defaultTab: "providers", // separador inicial: providers | extract | torrents
  animeAudio: "sub", // anime: "sub" (legendado) ou "dub" (dobrado)
  showAdult: false, // mostrar conteudo adulto (anime NSFW/hentai) na pesquisa/filtros
  accent: "#c90303", // cor de destaque da UI (botoes, realces)
  bgColor: "#070708", // cor de fundo da app
  bgStyle: "none", // estilo de fundo: none|glow|aurora|mesh|dots|grid|image
  bgImage: "", // URL da imagem de fundo (quando bgStyle === "image")
  recentAccent: [], // últimas cores de destaque escolhidas no picker
  recentBg: [], // últimas cores de fundo escolhidas no picker
  cardW: 184, // largura dos cartazes (px)
  cardH: 272, // altura dos cartazes (px)
  autoplay: true, // reproduzir automaticamente ao abrir uma fonte
  autoskip: false, // tentar saltar intro/genericos automaticamente
  discordPresence: true, // mostrar no Discord o que se está a ver (grátis, local)
  // A ultima fonte escolhida, POR TIPO de titulo: { movie: "", tv: "", anime: "" }.
  //
  // Por tipo e nao por episodio: quem escolheu o MegaPlay porque e' o unico com
  // legendas nao devia ter de o escolher em cada episodio. E nao por titulo
  // (tipo:id) porque um provider que serve um filme serve os outros do mesmo
  // tipo, e uma entrada por titulo enche o localStorage e nunca se limpa.
  //
  // `""` = ainda nao escolheu nenhuma, e o Player arranca na primeira fonte como
  // sempre.
  lastSource: { movie: "", tv: "", anime: "" },
};

/**
 * Migração das definições guardadas: `titleLang: "en"` passa a `"auto"`.
 *
 * Feita **uma vez**, com uma marca no `localStorage`. Sem a marca, `"auto"`
 * seria reescrito para `"en"` em cada arranque e ninguém poderia escolher
 * inglês de propósito.
 *
 * O custo é que também muda a escolha de quem tinha escolhido inglês à mão.
 * Não há forma de distinguir as duas coisas — o valor guardado é o mesmo.
 *
 * Exportada para o teste poder chamar as duas metades (com e sem a marca).
 */
export function migrarTitleLang(guardado, jaMigrou) {
  if (jaMigrou) return guardado;
  return guardado === "en" ? "auto" : guardado;
}

/**
 * Aplica as migrações de Definições e grava o resultado.
 *
 * A migração do `titleLang` é a única por agora. Corre **uma vez**: a marca
 * escreve-se no arranque em que a migração acontece, e a partir daí o valor
 * guardado é sempre respeitado — senão quem escolhesse "Inglês" à propósito
 * via-se a "auto" em cada arranque, sem forma de o travar.
 */
function aplicarMigracoes(guardado) {
  const jaMigrou = migracao.get() === "1";
  const novo = { ...guardado };
  let mudou = false;
  const titulo = migrarTitleLang(guardado?.titleLang, jaMigrou);
  if (titulo !== guardado?.titleLang) {
    novo.titleLang = titulo;
    mudou = true;
  }
  if (!jaMigrou) migracao.set("1");
  if (mudou) {
    // Grava-se para que a migração fique feita mesmo que o browser feche a
    // seguir. Se falhar (quota), o `get()` volta a aplicá-la — também inofensivo.
    settingsStore.set(novo);
  }
  return novo;
}

export const settingsStore = {
  get() {
    const cru = store.raw();
    if (!cru) return { ...DEFAULT_SETTINGS };
    let guardado;
    try {
      guardado = JSON.parse(cru);
    } catch (e) {
      // NÃO engolir em silêncio. Antes, um `catch { return padroes }` fazia uma
      // definição corrompida repor tudo sem aviso nenhum: o utilizador perdia
      // a imagem de fundo, o accent, as legendas... e via um ecrã preto sem
      // nenhum sinal de porque. Guarda-se o que estava lá (para se recuperar à
      // mão) e escreve-se na consola.
      console.warn(
        "[settings] stored settings are corrupt and were reset to defaults. " +
          "Kept a copy under " + SETTINGS_KEY + "_aviso. Detail: " +
          (e && e.message)
      );
      aviso.set(cru.slice(0, 200000));
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...aplicarMigracoes(guardado) };
  },

  set(s) {
    // Devolve false quando o localStorage recusou a escrita (o mais comum é a
    // quota, com uma imagem de fundo grande). Quem chama mostra o aviso.
    return store.set(s);
  },
};