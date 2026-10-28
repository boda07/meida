import { useCallback } from "react";
import { useSettings } from "../settings/SettingsContext.jsx";
import {
  TAMANHOS,
  FONTES,
  OPACIDADE_MIN,
  OPACIDADE_MAX,
  DELAY_MIN,
  DELAY_MAX,
  limitar,
} from "./legendas.js";

// Preferencias de exibicao de legendas.
//
// Responsabilidade unica: ler/escrever tamanho, opacidade, fonte e atraso de
// legendas via `useSettings`, com validacao de intervalos.
//
// Devolve: { subTamanho, subOpacidade, subFonte, subDelay, updateSubtitles }
export function useSubtitlePreferences() {
  const { settings, update } = useSettings();

  const subTamanho = settings.subTamanho || "normal";
  const subOpacidade = limitar(
    Number(settings.subOpacidade || 1),
    OPACIDADE_MIN,
    OPACIDADE_MAX,
    1
  );
  const subFonte = settings.subFonte || "";
  const subDelay = limitar(
    Number(settings.subDelay || 0),
    DELAY_MIN,
    DELAY_MAX,
    0
  );

  const updateSubtitles = useCallback(
    (campo, valor) => {
      update({ [campo]: valor });
    },
    [update]
  );

  return {
    subTamanho,
    subOpacidade,
    subFonte,
    subDelay,
    updateSubtitles,
    TAMANHOS,
    FONTES,
    OPACIDADE_MIN,
    OPACIDADE_MAX,
    DELAY_MIN,
    DELAY_MAX,
  };
}
