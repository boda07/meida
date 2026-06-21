import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Login({ mode = "login" }) {
  const isRegister = mode === "register";
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isRegister) await register(username, password);
      else await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>{isRegister ? "Criar conta" : "Entrar"}</h1>
        {error && <p className="auth-error">{error}</p>}
        <label>
          Utilizador
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "..." : isRegister ? "Criar conta" : "Entrar"}
        </button>
        <p className="auth-switch">
          {isRegister ? (
            <>
              Já tens conta? <Link to="/login">Entrar</Link>
            </>
          ) : (
            <>
              Não tens conta? <Link to="/register">Criar conta</Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
