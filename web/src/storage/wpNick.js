// O nome (nick) usado no Watch Party. Fica neste PC para não se ter de
// escrever sempre. `json: false` porque é texto.
import { criarStore } from "./criarStore.js";

const store = criarStore("wp_nick", { json: false });

export const wpNickStore = {
  get: () => store.get(),
  set: (v) => store.set(v),
};