import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { UserIcon } from "./icons.jsx";
import Avatar from "./Avatar.jsx";
import { useT } from "../i18n/I18nContext.jsx";

export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [updMsg, setUpdMsg] = useState(null);
  const ref = useRef(null);

  async function checkUpdate() {
    // Fora da app instalada (browser) nao ha atualizacao automatica.
    if (!window.electronAPI?.checkForUpdates) {
      setUpdMsg(t("Atualizações automáticas só na app instalada."));
      return;
    }
    setUpdMsg(t("A procurar..."));
    try {
      const r = await window.electronAPI.checkForUpdates();
      if (r?.status === "available")
        setUpdMsg(t("Nova versão {v} — a descarregar...", { v: r.version }));
      else if (r?.status === "latest") setUpdMsg(t("Já tens a versão mais recente. ✓"));
      else if (r?.status === "dev") setUpdMsg(t("Indisponível em desenvolvimento."));
      else setUpdMsg(t("Não foi possível verificar agora."));
    } catch {
      setUpdMsg(t("Não foi possível verificar agora."));
    }
  }

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Sem sessao: icone que leva ao login. O menu completo (e portanto o
  // "Procurar atualizacao") fica para quem tem conta; quem nao tem usa
  // Definis > Avancado, que tambem tem o botao e nao pede login.
  if (!user) {
    return (
      <Link to="/login" className="icon-btn" title={t("Entrar")} aria-label={t("Entrar")}>
        <UserIcon />
      </Link>
    );
  }

  return (
    <div className="profile" ref={ref}>
      <button
        className="avatar"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("Conta")}
      >
        <Avatar avatar={user.avatar} name={user.username} size={38} />
      </button>
      {open && (
        <div className="profile-menu">
          <span className="profile-name">{user.username}</span>
          <Link to="/library" onClick={() => setOpen(false)}>
            {t("A minha lista")}
          </Link>
           <Link to="/diary" onClick={() => setOpen(false)}>
             {t("Diário")}
           </Link>
           <Link to="/achievements" onClick={() => setOpen(false)}>
             {t("Conquistas")}
           </Link>
           <Link to="/stats" onClick={() => setOpen(false)}>
             {t("Estatísticas")}
           </Link>
           <Link to="/compare" onClick={() => setOpen(false)}>
             {t("Compara as tuas notas")}
           </Link>
           <Link to={`/u/${encodeURIComponent(user.username)}`} onClick={() => setOpen(false)}>
             {t("O meu perfil")}
           </Link>
           <Link to="/users" onClick={() => setOpen(false)}>
             {t("Encontrar pessoas")}
           </Link>
          <Link to="/settings" onClick={() => setOpen(false)}>
            {t("Definições")}
          </Link>
          <button onClick={checkUpdate}>{t("Procurar atualização")}</button>
          {updMsg && <span className="profile-upd-msg">{updMsg}</span>}
          <button onClick={logout}>{t("Sair")}</button>
        </div>
      )}
    </div>
  );
}
