// A última versão do changelog que o utilizador viu.
//
// Serve para o ponto vermelho: se a versão guardada for anterior à build, há
// novidades. `json: false` porque é só texto.
import { criarStore } from "./criarStore.js";

const store = criarStore("meida_seen_version", { json: false });

export const changelogStore = {
  get: () => store.get(),
  set: (v) => store.set(v),
};