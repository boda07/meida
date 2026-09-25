import { Component } from "react";

// Error boundary a nivel da app: se uma pagina/componente lancar um erro de
// render, mostra uma mensagem com opcao de recarregar em vez de ficar um ecra
// branco (o comportamento default do React sem boundary).
export default class ErrorBoundary extends Component {
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
          <h2>Algo correu mal</h2>
          <p className="muted">
            Ocorreu um erro ao mostrar esta página. Recarrega para tentar de novo.
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
              ‹ Voltar atrás
            </button>
            <button className="btn" onClick={() => window.location.reload()}>
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
