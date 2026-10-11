import { Component } from "react";
import { I18nContext } from "../i18n/I18nContext.jsx";

// Error boundary a nivel da app: se uma pagina/componente lancar um erro de
// render, mostra uma mensagem com opcao de recarregar em vez de ficar um ecra
// branco (o comportamento default do React sem boundary).
//
// NOTA 1: isto e' uma `class`, e classes NAO podem usar hooks (`useT`). O `t` vem
// pelo `contextType`, que e' o equivalente para classes. (A primeira versao
// tinha `useT()` aqui e o build quebrava.)
//
// NOTA 2 — o `t` CHAMA-SE, nao se acede a `.t`. O valor do `I18nContext` e' a
// propria funcao `t` (ver `I18nProvider`: `return t`, nao `return { t }`), por
// isso e' `this.context(...)` e nao `this.context.t(...)`.
//
// Isto esteve partido desde que o i18n entrou (2026-10-10) e nunca se notou
// porque nenhuma pagina tinha lancado. Ate aparecer uma, em 2026-10-11: a
// primeira queda mostrava "ecra branco sem nada", porque um boundary que LANCA
// ao renderizar faz o React desmontar a arvore toda — o oposto do que se
// queria. Pior: a pessoa perdia tambem o header e o botao de voltar, e ficava
// presa. Por isso `tSeguro()` abaixo nunca lanca, mesmo sem provider.
export default class ErrorBoundary extends Component {
  // Faz o `this.context` ser o valor do I18nProvider — a funcao `t`. Ver
  // https://react.dev/reference/react/Component#static-contexttype
  static contextType = I18nContext;

  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  // O boundary NUNCA pode lancar. Se lancar, o React desmonta tudo e o
  // utilizador fica com um ecra vazio sem nenhuma forma de sair — que e'
  // exactamente o pior resultado possivel. Sem provider do i18n (ou com um
  // contexto inesperado) fica o portugues, que e' sempre melhor do que nada.
  tSeguro(texto) {
    try {
      return typeof this.context === "function" ? this.context(texto) : texto;
    } catch {
      return texto;
    }
  }

  render() {
    if (this.state.error) {
      const detalhe = String(this.state.error?.message || this.state.error || "");
      return (
        <div className="error-boundary">
          <h2>{this.tSeguro("Algo correu mal")}</h2>
          <p className="muted">
            {this.tSeguro(
              "Ocorreu um erro ao mostrar esta página. Recarrega para tentar de novo."
            )}
          </p>
          {/* A mensagem do erro, sempre. Antes so aparecia com `dev`, e sem ela
              nao ha forma de saber o que falhou — o unico sintoma era um ecra
              em branco. */}
          {detalhe && <pre className="error-boundary-detail">{detalhe}</pre>}
          <div className="error-boundary-actions">
            <button
              className="btn"
              onClick={() => {
                // Volta para a página anterior (ou para o início se nao houver).
                if (
                  typeof window !== "undefined" &&
                  window.history &&
                  window.history.length > 1
                ) {
                  window.history.back();
                } else {
                  window.location.assign("/");
                }
              }}
            >
              ‹ {this.tSeguro("Voltar atrás")}
            </button>
            <button className="btn" onClick={() => window.location.reload()}>
              {this.tSeguro("Recarregar")}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
