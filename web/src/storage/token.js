// O token de sessão. `json: false` porque é texto simples.
//
// Fica aqui (e não no `api/client.js`) para o `WatchPartyContext` poder lê-lo
// sem voltar a falar com o `localStorage` por conta própria.
import { criarStore } from "./criarStore.js";

const store = criarStore("streamapp_token", { json: false });

export const tokenStore = {
  get: () => store.get(),
  set: (t) => store.set(t),
  clear: () => store.remove(),
};