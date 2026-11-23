// Presenca no Discord e a ultima posicao que um player reportou.
//
// Tres estados, conforme o que sabemos — e o que sabemos e' "chegou progresso?",
// nao "esta a tocar?".
//
//   "a-ver"     : o progresso chega (players nossos). O Discord conta tempo.
//   "pausa"     : o progresso chegou e parou. O Discord congela e diz "Pausado".
//   "sem-dados" : nunca chegou progresso (players em iframe: MegaPlay, VidLove,
//                 ...). NAO se diz nada sobre o estado: o Discord mostra o
//                 titulo sem contador e sem "Pausado".
//
// A distincao entre "pausa" e "sem-dados" e' o que faltava. Antes, "sem
// progresso" era lido como "em pausa" e os iframes ficavam sempre marcados como
// pausados, mesmo com o video a dar. E antes disso, todos ficavam sempre "a
// ver", mesmo sem dar play.
//
// `PRESENCA_PAUSADA_MS` esta entre o intervalo com que o player reporta (uns
// 5 s) e o intervalo minimo do Discord (15 s): a pausa aparece sem esperarmos
// pelo proximo update.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { clearPresence, showPresence } from "../discord.js";

const PRESENCA_PAUSADA_MS = 10000;

export function usePresenca({ user, details, active, season, episode, activeProviderRef }) {
  const [presencaEstado, setPresencaEstado] = useState("sem-dados");
  const ultimoProgressoRef = useRef(0);
  // Uma vez que houve progresso, soubemos que este player da' sinal. Sem isto,
  // um player nosso que arranca devagar seria tomado por um iframe em vez de
  // "ainda nao comecou".
  const viuProgressoRef = useRef(false);
  // Ultima posicao de video que um player reportou (segundos). Serve para o
  // botao "neste momento" dos comentarios. Nos providers em iframe nao ha
  // posicao a que pegar, e por isso fica null.
  const [posAtual, setPosAtual] = useState(null);

  // Trocar de episodio/fonte invalida o tempo: o "12:34" era do anterior.
  useEffect(() => {
    setPosAtual(null);
  }, [details?.id, season, episode]);

  useEffect(() => {
    if (!details?.title || !active) {
      clearPresence();
      return undefined;
    }
    ultimoProgressoRef.current = Date.now();
    // Fonte nova: ainda nao sabemos nada sobre ela. So' quando `reportPos`
    // chegar e' que passamos a "a-ver".
    viuProgressoRef.current = false;
    setPresencaEstado("sem-dados");
    const t = setInterval(() => {
      const semSinal = Date.now() - ultimoProgressoRef.current > PRESENCA_PAUSADA_MS;
      setPresencaEstado((antes) => {
        // Nunca houve progresso: continuamos sem dados (iframe, ou ainda nao
        // comecou a dar). Nao e' pausa — e' falta de informacao.
        if (!viuProgressoRef.current) return antes === "sem-dados" ? antes : "sem-dados";
        // Houve progresso e agora nao ha: pausa a valer.
        return semSinal ? "pausa" : "a-ver";
      });
    }, 3000);
    return () => clearInterval(t);
    // `details` pela identidade nao: muda a cada pedido e reiniciaria o estado
    // sem motivo. So' as propriedades que o efeito le.
  }, [details?.title, details?.type, details?.poster, active, season, episode]);

  // O intervalo acima so muda o estado. Este efeito e' que o leva ao Discord —
  // sem ele, `presencaEstado` nao chegava a lado nenhum. Nao leva `position`: o
  // `subLine` so escreve o tempo se a posicao existir, e quem a manda e' o
  // `reportPos` abaixo.
  useEffect(() => {
    if (!details?.title || !active) return;
    showPresence({
      title: details.title,
      type: details.type,
      season: details.type === "tv" ? season : null,
      episode: details.type === "anime" || details.type === "tv" ? episode : null,
      poster: details.poster,
      estado: presencaEstado,
    });
    // Ver a nota do efeito de cima: `details` pela identidade reiniciaria o
    // estado a cada pedido.
  }, [details?.title, details?.type, details?.poster, active, season, episode, presencaEstado]);

  const reportPos = useCallback(
    (position, duration) => {
      if (!user || !details) return;
      api
        .progressPosition({
          type: details.type,
          tmdbId: details.id,
          title: details.title,
          poster: details.poster,
          season: details.type === "tv" ? season : null,
          episode: details.type === "anime" || details.type === "tv" ? episode : null,
          position,
          duration,
          provider: activeProviderRef.current,
        })
        .catch(() => {});
      setPosAtual(position);
      // Chegou progresso, logo o video esta a dar. E, a partir de agora, sabemos
      // que este player da' sinal — uma ausencia futura e' pausa, nao falta de
      // informacao (ver `viuProgressoRef`).
      ultimoProgressoRef.current = Date.now();
      viuProgressoRef.current = true;
      setPresencaEstado("a-ver");
      // Presenca no Discord: aproveita o mesmo callback do progresso para mostrar
      // "12:34 / 45:00" enquanto se ve (o Discord filtra os updates a mais). Este
      // `showPresence` e' o unico que leva `position` — o efeito acima so leva o
      // estado, porque nao tem a posicao.
      showPresence({
        title: details.title,
        type: details.type,
        season: details.type === "tv" ? season : null,
        episode: details.type === "anime" || details.type === "tv" ? episode : null,
        poster: details.poster,
        position,
        duration,
        estado: "a-ver",
      });
    },
    [user, details, season, episode, activeProviderRef]
  );

  // Presenca no Discord (gratis): o titulo aparece assim que escolhes uma fonte e
  // desaparece se tirares a fonte ou saires da ficha. O que o Discord diz sobre
  // o estado e' decidido pelo efeito acima (`presencaEstado`), nao aqui.
  //
  // O efeito antigo — que mostrava assim que se escolhia uma fonte, sempre "a
  // ver" e sem nunca parar — foi removido: era a origem do defeito. A nota de
  // que "nos providers com iframe nao da para saber se estao a tocar" continua
  // verdadeira, mas so justifica mostrar o TITULO, nao mostrar como se
  // estivesse a ver. Dai o estado "sem-dados".
  //
  // Saiu da ficha -> esconde a presenca (senao ficava "A ver ..." para sempre).
  useEffect(() => () => clearPresence(), []);

  return { presencaEstado, reportPos, posAtual };
}