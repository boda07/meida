import { useNavigate } from "react-router-dom";

// Botao fixo no topo esquerdo: volta atras no historico de navegacao.
export default function BackButton() {
  const navigate = useNavigate();
  return (
    <button
      className="app-back-btn"
      onClick={() => navigate(-1)}
      title="Voltar atras"
      aria-label="Voltar atras"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
