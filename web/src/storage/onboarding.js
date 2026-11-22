// O estado do onboarding (já feito/dispensado + géneros escolhidos).
//
// Vive neste PC, não no servidor: é uma preferência de arranque, não um dado
// partilhado. O `App.jsx` lê-o para decidir se mostra a linha dos géneros e o
// `Onboarding.jsx` escreve-o ao fechar o wizard.
import { criarStore } from "./criarStore.js";

const store = criarStore("meida_onboarding_v1", { fallback: {} });

export const onboardingStore = {
  get() {
    const v = store.get();
    return v && typeof v === "object" ? v : {};
  },
  set(v) {
    return store.set(v);
  },
};