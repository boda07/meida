import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { UserIcon } from "./icons.jsx";
import Avatar from "./Avatar.jsx";

export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Sem sessao: icone que leva ao login.
  if (!user) {
    return (
      <Link to="/login" className="icon-btn" title="Entrar" aria-label="Entrar">
        <UserIcon />
      </Link>
    );
  }

  return (
    <div className="profile" ref={ref}>
      <button
        className="avatar"
        onClick={() => setOpen((o) => !o)}
        aria-label="Conta"
      >
        <Avatar avatar={user.avatar} name={user.username} size={38} />
      </button>
      {open && (
        <div className="profile-menu">
          <span className="profile-name">{user.username}</span>
          <Link to="/library" onClick={() => setOpen(false)}>
            A minha lista
          </Link>
          <Link to="/diary" onClick={() => setOpen(false)}>
            Diário
          </Link>
          <Link to="/settings" onClick={() => setOpen(false)}>
            Definições
          </Link>
          <button onClick={logout}>Sair</button>
        </div>
      )}
    </div>
  );
}
