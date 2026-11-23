// Audio deste titulo (anime): sub/dub.
//
// A escolha vive **por titulo** (audioTituloStore), nao nas Definicoes: ha
// animes que so existem dobrados e outros sem dobrado nenhum, e uma definicao
// global obrigava a trocar sempre. Sem entrada guardada, segue as Definicoes.
import { useEffect, useState } from "react";
import { audioTituloStore } from "../api/client.js";

export function useAudioTitulo({ details, animeAudioDefault }) {
  // Chave do titulo: "tipo:id", o mesmo formato que se usa no resto da pagina.
  const chaveAudio = details ? `${details.type}:${details.id}` : null;
  const [localAudio, setLocalAudio] = useState(null);

  // Carrega a preferencia guardada deste titulo assim que os detalhes chegam.
  // Sem isto a escolha vivia so enquanto a pagina estivesse aberta: ao voltar
  // ao Inicio e clicar outra vez em "continua a ver", voltava ao "sub" das
  // Definicoes.
  useEffect(() => {
    if (!chaveAudio) return;
    setLocalAudio(audioTituloStore.get(chaveAudio));
  }, [chaveAudio]);

  const animeAudio = localAudio || animeAudioDefault;

  // Unico ponto de escrita do audio, para os dois sitios que o escolhem (a
  // barra em cima e os chips dos torrents) gravarem igual.
  //
  // "all" e' exclusivo dos torrents (ver todos os ficheiros, sem escolher
  // audio) e nao corresponde a nenhum valor de URL de provider, por isso NAO
  // mexe na preferencia guardada: se a pessoa tinha o Dragon Ball em dub e foi
  // so ver "Todos" na lista, o dub continua a ser o dos providers.
  function escolherAudio(a) {
    if (a !== "dub" && a !== "sub") return;
    setLocalAudio(a);
    if (chaveAudio) audioTituloStore.set(chaveAudio, a);
  }

  return { animeAudio, escolherAudio };
}