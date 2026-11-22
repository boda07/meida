// O estado de ecrã inteiro da janela (o botão do canto).
//
// `fullscreenchange` é o único sinal fiável: pedir `document.fullscreenElement`
// só no clique deixava o botão a dizer "sair" depois de o utilizador sair com
// F11 ou com o gesto do sistema.
import { useEffect, useState } from "react";

export function useEcraInteiro() {
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    const onChange = () => setAtivo(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    onChange(); // estado inicial (pode já estar em ecrã inteiro ao montar)
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return ativo;
}