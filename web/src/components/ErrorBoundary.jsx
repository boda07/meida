import { Component } from "react";
import { I18nContext } from "../i18n/I18nContext.jsx";

// Error boundary a nivel da app: se uma pagina/componente lancar um erro de
// render, mostra uma mensagem com opcao de recarregar em vez de ficar um ecra
// branco (o comportamento default do React sem boundary).
//
// NOTA: isto e' uma `class`, e classes NAO podem usar hooks (`useT`). O `t` vem
// pelo `contextType`, que e' o equivalente para classes. (A primeira versao
// tinha `useT()` aqui e o build quebrava.)
export default class ErrorBoundary extends Component {
  // Faz o `this.context` ser o valor do I18nProvider — ou seja, o objecto com
  // o `t`. Ver https://react.dev/reference/react/Component#static-contexttype
  static contextType = I18nContext;

  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h2>{this.context.t("Algo correu mal")}</h2>
          <p className="muted">
            {this.context.t("Ocorreu um erro ao mostrar esta página. Recarrega para tentar de novo.")}
          </p>
          {this.props.dev && (
            <pre className="error-boundary-detail">{String(this.state.error)}</pre>
          )}
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
              ‹ {this.context.t("Voltar atrás")}
            </button>
            <button className="btn" onClick={() => window.location.reload()}>
              {this.context.t("Recarregar")}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
