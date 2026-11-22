// A aba activa das Definições. Guardada no browser para não voltar ao
// "Perfil" a cada visita (e para não perder o scroll de quem só anda a ver as
// contas ligadas).
import { criarStore } from "./criarStore.js";

const store = criarStore("meida:settings-tab", { json: false, fallback: "perfil" });

export const settingsTabStore = {
  get: () => store.get(),
  set: (v) => store.set(v),
};