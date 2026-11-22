// Áudio POR TÍTULO (anime): "dub" ou "sub", guardado à parte das Definições.
//
// Porquê não nas Definições: há animes que só existem dobrados e outros que
// não têm dobrado nenhum. Uma definição global obriga a trocar sempre — que era
// o que se passava com o Dragon Ball (medido a 2026-10-06).
//
// Chave "tipo:id" (ex.: "anime:1234"). Sem entrada = segue a Definição global.
// Fica em localStorage como o resto das preferências: NÃO vai para o servidor,
// portanto não acompanha entre PCs.
import { criarStore } from "./criarStore.js";

const AUDIO_KEY = "streamapp_audio_titulos";
const store = criarStore(AUDIO_KEY, { fallback: {} });

export const audioTituloStore = {
  get(chave) {
    const v = store.get();
    const valor = v && typeof v === "object" ? v[chave] : null;
    return valor === "dub" || valor === "sub" ? valor : null;
  },
  set(chave, audio) {
    if (audio !== "dub" && audio !== "sub") return;
    const v = store.get();
    const novo = v && typeof v === "object" ? v : {};
    novo[chave] = audio;
    store.set(novo);
  },
};