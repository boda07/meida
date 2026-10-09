// Uma caixa de comentario com "@mencoes": escreves @, aparece uma lista, escolhes
// com o teclado (ou com o rato) e o nome fica escrito.
//
// E' um componente proprio, e nao um bocado do `Comments.jsx`, porque ha dois
// lugares a escrever comentarios (o principal e a resposta) e a logica do cursor
// e' mais do que trivial de duplicar.
//
// As regras estao em `../lib/mencoes.js`, testadas em `scripts/testar-mencoes.mjs`.
// Aqui so ha o que precisa de React e de DOM: ouvir o teclado, mostrar a lista e
// mexer no cursor.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { mencaoEmCurso, insereMencao, pedacosComMencoes } from "../lib/mencoes.js";
import Avatar from "./Avatar.jsx";

// Quanto tempo se espera antes de perguntar ao servidor quem ha' para sugerir.
// Sem isto, cada tecla de "@ana" ia ao servidor.
const DEMORA_MS = 180;
// Teto de resultados mostrados. Com 20 na base, mais do que isso nao cabe.
const MAXIMO = 8;

export function TextoComMencoes({ value, onChange, placeholder, rows = 2, maxLength = 2000, className = "comment-input", autoFocus = false }) {
  const [sugestoes, setSugestoes] = useState([]);
  const [ligados, setLigados] = useState([]);
  const [activo, setActivo] = useState(0);
  const [menuAberto, setMenuAberto] = useState(false);
  const ta = useRef(null);
  // O `onChange` e' chamado logo apos escrever; o cursor le-se do DOM porque o
  // `value` do React ainda nao reflecte a mudanca nesta altura.
  const cursorRef = useRef(0);

  const pedir = useCallback((termo) => {
    api
      .sugerirUsers(termo)
      .then((d) => {
        setSugestoes((d.users || []).slice(0, MAXIMO));
        setLigados(d.linked || []);
        setActivo(0);
        setMenuAberto(true);
      })
      .catch(() => {
        // Sem rede a lista nao abre, mas escrever "@fulano" a mao continua a
        // funcionar: o servidor resolve o nome na mesma. Por isso nada de erro.
        setSugestoes([]);
        setMenuAberto(false);
      });
  }, []);

  // Refresca a lista quando a mencao em curso muda.
  useEffect(() => {
    const m = mencaoEmCurso(value, cursorRef.current);
    if (!m) {
      setMenuAberto(false);
      setSugestoes([]);
      return undefined;
    }
    if (m.query.length < 1) {
      // Acabou de escrever o "@": mostra logo toda a gente. Sem isto a lista
      // so aparecia depois da primeira letra, e "@ " parecia nao funcionar.
      setSugestoes([]);
      setMenuAberto(false);
      const t = setTimeout(() => pedir(""), DEMORA_MS);
      return () => clearTimeout(t);
    }
    setMenuAberto(false);
    const t = setTimeout(() => pedir(m.query), DEMORA_MS);
    return () => clearTimeout(t);
  }, [value, pedir]);

  const escolher = useCallback(
    (u) => {
      const m = mencaoEmCurso(value, cursorRef.current);
      const { texto, cursor } = insereMencao(value, cursorRef.current, u.username);
      onChange(texto);
      cursorRef.current = cursor;
      setMenuAberto(false);
      setSugestoes([]);
      // O cursor so pode ser posto depois do React escrever o novo valor; antes
      // disso o textarea ainda tem o texto antigo e a selecao cai no sitio errado.
      requestAnimationFrame(() => {
        const el = ta.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(cursor, cursor);
      });
      void m;
    },
    [value, onChange]
  );

  function onKeyDown(e) {
    if (!menuAberto || sugestoes.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => (i + 1) % sugestoes.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => (i - 1 + sugestoes.length) % sugestoes.length);
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      escolher(sugestoes[activo]);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setMenuAberto(false);
    }
  }

  return (
    <div className="mencao-wrap">
      <textarea
        ref={ta}
        className={className}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        onChange={(e) => {
          cursorRef.current = e.target.selectionStart ?? e.target.value.length;
          onChange(e.target.value);
        }}
        onKeyUp={(e) => {
          // O cursor tambem muda com as setas e com o rato, sem dar `onChange`.
          cursorRef.current = e.target.selectionStart ?? value.length;
        }}
        onClick={(e) => {
          cursorRef.current = e.currentTarget.selectionStart ?? value.length;
        }}
        onBlur={() => setTimeout(() => setMenuAberto(false), 120)}
        onKeyDown={onKeyDown}
      />
      {menuAberto && sugestoes.length > 0 && (
        <ul className="mencao-lista" role="listbox">
          {sugestoes.map((u, i) => (
            <li key={u.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === activo}
                className={`mencao-opcao ${i === activo ? "on" : ""}`}
                onMouseDown={(e) => {
                  // `mousedown` e nao `click`: o `blur` do textarea chega
                  // primeiro e fechava o menu antes do click. E' por isso que o
                  // `onBlur` tem aquele `setTimeout` de 120 ms.
                  e.preventDefault();
                  escolher(u);
                }}
                onMouseEnter={() => setActivo(i)}
              >
                <Avatar avatar={u.avatar} name={u.username} size={22} />
                <span className="mencao-nome">{u.username}</span>
                {ligados.includes(u.id) && <span className="mencao-ligacao">segues</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * O corpo do comentario desenhado, com as "@mencoes" a virar link para o perfil.
 *
 * Devolve elementos, nunca HTML: o corpo do comentario e' texto do utilizador e
 * vai tal e qual para a base de dados, por isso nao ha nada aqui que possa
 * injectar marcação.
 */
export function CorpoDoComentario({ body }) {
  const pedacos = pedacosComMencoes(body);
  if (pedacos.length === 0) return body;
  return pedacos.map((p, i) =>
    p.tipo === "mencao" ? (
      // A key e' o indice porque dois "@fulano" no mesmo comentario sao iguais.
      <Link key={`${i}-${p.texto}`} className="mencao-link" to={`/u/${encodeURIComponent(p.texto)}`}>
        @{p.texto}
      </Link>
    ) : (
      <span key={`${i}-t`}>{p.texto}</span>
    )
  );
}
