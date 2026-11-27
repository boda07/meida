import { useCallback } from "react";
import { useSettings } from "../settings/SettingsContext.jsx";
import {
  TAMANHOS,
  FONTES,
  OPACIDADE_MIN,
  OPACIDADE_MAX,
  OPACIDADE_DEF,
  DELAY_MIN,
  DELAY_MAX,
  limitar,
} from "./legendas.js";

// Preferencias de exibicao de legendas.
//
// Responsabilidade unica: ler/escrever tamanho, opacidade do FUNDO, fonte,
// contorno, cores e atraso via `useSettings`, com validacao de intervalos.
//
// Devolve: { subTamanho, subOpacidade, subFonte, subContorno, subCorTexto,
//           subCorFundo, subDelay, updateSubtitles }
export function useSubtitlePreferences() {
  const { settings, update } = useSettings();

  const subTamanho = settings.subTamanho || "normal";
  const subOpacidade = limitar(
    Number(settings.subOpacidade ?? OPACIDADE_DEF),
    OPACIDADE_MIN,
    OPACIDADE_MAX,
    OPACIDADE_DEF
  );
  const subFonte = settings.subFonte || "";
  const subContorno =
    settings.subContorno === undefined ? "sombra" : String(settings.subContorno);
  const subCorTexto = settings.subCorTexto || "branco";
  const subCorFundo = settings.subCorFundo || "preto";
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
    subContorno,
    subCorTexto,
    subCorFundo,
    subDelay,
    updateSubtitles,
    TAMANHOS,
    FONTES,
    OPACIDADE_MIN,
    OPACIDADE_MAX,
    OPACIDADE_DEF,
    DELAY_MIN,
    DELAY_MAX,
  };
}
