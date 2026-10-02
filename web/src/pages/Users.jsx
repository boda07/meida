// Descobrir pessoas: pesquisa por nome e lista os resultados com link para o
// perfil. O seguir acontece na página do perfil.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import Avatar from "../components/Avatar.jsx";

export default function Users() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    // Pequeno atraso para não disparar um pedido a cada tecla.
    const t = setTimeout(() => {
      api
        .searchUsers(term)
        .then((d) => alive && setResults(d.users || []))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="sub-page users-page">
      <h2 className="row-title">Encontrar pessoas</h2>
      <input
        className="users-search"
        type="search"
        placeholder="Escreve um nome de utilizador..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />

      {loading && <p className="muted">A procurar...</p>}

      {!loading && results !== null && results.length === 0 && (
        <p className="muted">Nenhum utilizador encontrado.</p>
      )}

      {results !== null && results.length > 0 && (
        <ul className="people-list">
          {results.map((u) => (
            <li key={u.id} className="people-row">
              <Link to={`/u/${encodeURIComponent(u.username)}`} className="people-link">
                <Avatar avatar={u.avatar} name={u.username} size={40} />
                <span>{u.username}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
