import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n/I18nContext.jsx";

/**
 * Botao de QUALIDADE dentro da barra de controlos, com a lista num popup.
 *
 * ANTES era um `<select>` ("Qualidade:") a flutuar POR BAIXO do video, fora do
 * jogador. Com a barra de controlos a ser nossa (ver `PlayerControls.jsx`) isso
 * via-se a dar mal — o seletor ficava ali a flutuar, fora de tudo. Agora e' um
 * botao na barra, com o mesmo popup das legendas (`SubtitleMenu`), e o botao
 * MOSTRA a resolucao que esta' a dar. E' o que fazem o YouTube e a Netflix, e
 * evita ter de abrir o menu para saber em que se esta'.
 *
 * SÓ aparece com duas ou mais variantes. Nos sitios que so' servem uma (1080p e
 * nada mais — a maioria, medido: 19 de 25 episodios) nao ha' o que escolher, e
 * um botao que abre um menu com uma opcao so' e' ruido. E' por isso que o
 * `return null` e' a primeira coisa.
 */
export default function QualityMenu({ niveis = [], nivelAuto = true, ativo = -1, onMudar }) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef(null);

  // Clicar fora fecha, `Escape` fecha. Mesmo comportamento do menu de legendas —
  // se um deles fechar e o outro nao, parece um bug.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => {
      if (caixaRef.current && !caixaRef.current.contains(e.target)) setAberto(false);
    };
    const esc = (e) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  // Escolher fecha o popup: ao contrario do das legendas (onde o popup tem
  // ainda as opcoes de tamanho e atraso), aqui nao ha' nada mais para fazer
  // depois de escolher, e um menu que fica aberto so' atrapalha o video.
  const escolher = (valor) => {
    onMudar(valor);
    setAberto(false);
  };

  if (niveis.length < 2) return null;

  // O que esta' a dar AGORA. No automatico, o hls.js e' que decide e por isso
  // so' se sabe depois de comecar — ate la, mostra o que foi pedido.
  const mostrada = nivelAuto
    ? (ativo >= 0 && niveis[ativo]) || t("Automático")
    : niveis[ativo] || "";

  return (
    <div className="pc-qual" ref={caixaRef}>
      <button
        type="button"
        className="pc-btn pc-qual-btn"
        onClick={() => setAberto((a) => !a)}
        title={t("Qualidade")}
        aria-label={t("Qualidade")}
        aria-expanded={aberto}
      >
        {/* O texto da resolucao em vez de um icone: um "1080p" diz o que o
            icone de engrenagem nao diz. E' cabe em 34 px de altura. */}
        <span className="pc-qual-txt">{mostrada}</span>
      </button>

      {aberto && (
        <div className="pc-pop pc-qual-pop" role="menu">
          <div className="pc-pop-sec">
            <p className="pc-pop-titulo">{t("Qualidade")}</p>

            <button
              type="button"
              role="menuitemradio"
              aria-checked={nivelAuto}
              className={nivelAuto ? "on" : ""}
              onClick={() => escolher("auto")}
            >
              {/* No automatico mostra-se TAMBEM a resolucao em que esta': e' a
                  resposta a "mas qual e' que esta' a dar agora?". */}
              {nivelAuto && ativo >= 0 && niveis[ativo]
                ? `${t("Automático")} (${niveis[ativo]})`
                : t("Automático")}
            </button>

            {niveis.map((rotulo, i) => (
              <button
                key={i}
                type="button"
                role="menuitemradio"
                aria-checked={!nivelAuto && ativo === i}
                className={!nivelAuto && ativo === i ? "on" : ""}
                onClick={() => escolher(String(i))}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}