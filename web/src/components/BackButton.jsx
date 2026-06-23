import { useNavigate } from "react-router-dom";

// Botoes fixos no topo esquerdo: voltar atras / avancar no historico de navegacao.
export default function BackButton() {
  const navigate = useNavigate();
  return (
    <>
      <button
        className="app-back-btn"
        onClick={() => navigate(-1)}
        title="Voltar atrás"
        aria-label="Voltar atrás"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        className="app-fwd-btn"
        onClick={() => navigate(1)}
        title="Avançar"
        aria-label="Avançar"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </>
  );
}
