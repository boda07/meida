// Ecra de arranque: espera que o servidor de DADOS responda antes de mostrar a
// app. Sem isto, a versao web fica um ecra preto durante meio minuto — o
// servidor partilhado hiberna e o primeiro pedido passa 30-50 s a acordar.
//
// Este NAO e' o ecra estatico do `index.html` (`#boot`). Esse aparece no
// instante em que o HTML chega, sem esperar por um byte de JavaScript, e diz "a
// app esta a arrancar". Este diz "o servidor de dados esta a acordar", que
// demora muito mais e precisa de um contador. Os dois estao no sitio ao mesmo
// tempo, cada um no seu momento: o estatico primeiro, este a seguir.
import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n/I18nContext.jsx";
import { api } from "../api/client.js";

// Segundos decorridos ate cada mensagem. A ultima e' o limite: passados 90 s
// mostramos a app de qualquer maneira — melhor uma app a demorar do que um ecra
// de carregamento para sempre.
//
// As chaves sao as do dicionario: traduzem-se no `t(MENSAGENS[i][1])` em baixo.
const MENSAGENS = [
  [0, "A ligar ao servidor"], // i18n: chave do dicionario
  [6, "O servidor está a acordar. Pode demorar até um minuto."], // i18n
  [25, "Isto é normal depois de uma atualização. Não feches esta página."], // i18n
  [55, "Ainda a tentar. Se não abrir, recarrega a página."], // i18n
];
const LIMITE = 90; // segundos
const TENTAR_DE_NOVO = 4000; // ms entre tentativas

// Indice da mensagem para o tempo ja passado (a lista esta ordenada).
function indiceDaMensagem(segundos) {
  let i = 0;
  for (let s = 0; s < MENSAGENS.length; s++) {
    if (segundos >= MENSAGENS[s][0]) i = s;
  }
  return i;
}

export default function BootScreen({ children }) {
  const t = useT();
  const [pronto, setPronto] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const inicio = useRef(Date.now());
  const vivo = useRef(true);

  // Nao actualizar estado depois de o componente sair (o servidor respondeu no
  // fim e o React ja nao esta montado).
  useEffect(() => () => {
    vivo.current = false;
  }, []);

  useEffect(() => {
    let temporizador = null;

    // Insiste: o servidor pode estar a acordar e o primeiro pedido pode perder-se
    // (ou o fetch pode ser interrompido a meio), por isso repete ate responder.
    const tentar = () => {
      api
        .healthDados()
        .then(() => {
          if (vivo.current) setPronto(true);
        })
        .catch(() => {
          if (vivo.current) temporizador = setTimeout(tentar, TENTAR_DE_NOVO);
        });
    };
    tentar();

    const relogio = setInterval(() => {
      setSegundos(Math.floor((Date.now() - inicio.current) / 1000));
    }, 1000);

    return () => {
      clearInterval(relogio);
      clearTimeout(temporizador);
    };
  }, []);

  // Rede de seguranca: nem que o servidor nunca responda, ao fim de 90 s a app
  // aparece (as chamadas de dados vao falhar com mensagem propia, mas o utilizador
  // ve a interface em vez de um ecra preto sem fim).
  useEffect(() => {
    if (segundos >= LIMITE) setPronto(true);
  }, [segundos]);

  if (pronto) return children;

  const i = indiceDaMensagem(segundos);

  return (
    <div className="boot" role="status" aria-live="polite">
      <div className="boot-caixa">
        <div className="loading-ring boot-anel" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, k) => (
            <span key={k} style={{ "--i": k }} />
          ))}
        </div>
        <h1 className="boot-titulo">MEIDA</h1>
        <p className="boot-msg">{t(MENSAGENS[i][1])}</p>
        <p className="boot-contador" aria-hidden="true">
          {Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, "0")}
        </p>
        <p className="boot-dica">
          {t("Os teus dados ficam guardados no servidor. A app só espera que ele acorde.")}
        </p>
      </div>
    </div>
  );
}