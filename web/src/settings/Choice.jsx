// Botões de escolha única (estilo pílula). Apresentação pura: o estado
// (`current`) e a acção (`onPick`) vêm por props.
export default function Choice({ value, current, onPick, children }) {
  return (
    <button
      className={`set-choice ${current === value ? "active" : ""}`}
      onClick={() => onPick(value)}
    >
      {children}
    </button>
  );
}