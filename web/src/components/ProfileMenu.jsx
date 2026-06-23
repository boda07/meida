import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { UserIcon } from "./icons.jsx";
import Avatar from "./Avatar.jsx";

export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [updMsg, setUpdMsg] = useState(null);
  const ref = useRef(null);

  async function checkUpdate() {
    // Fora da app instalada (browser) nao ha atualizacao automatica.
    if (!window.electronAPI?.checkForUpdates) {
      setUpdMsg("Atualizações automáticas só na app instalada.");
      return;
    }
    setUpdMsg("A procurar...");
    try {
      const r = await window.electronAPI.checkForUpdates();
      if (r?.status === "available")
        setUpdMsg(`Nova versão ${r.version} — a descarregar...`);
      else if (r?.status === "latest") setUpdMsg("Já tens a versão mais recente. ✓");
      else if (r?.status === "dev") setUpdMsg("Indisponível em desenvolvimento.");
      else setUpdMsg("Não foi possível verificar agora.");
    } catch {
      setUpdMsg("Não foi possível verificar agora.");
    }
  }

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
          <button onClick={checkUpdate}>Procurar atualização</button>
          {updMsg && <span className="profile-upd-msg">{updMsg}</span>}
          <button onClick={logout}>Sair</button>
        </div>
      )}
    </div>
  );
}
