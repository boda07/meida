import { createContext, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "../api/client.js";

const AUTH_USER_KEY = "meida:user";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // Valida o token guardado e recupera o utilizador.
  //
  // O /auth/me pode falhar por motivos que nao estao relacionados com a sessao
  // estar expirada (servidor em baixo, rede lenta, 429, etc.). Nesses casos nao
  // devemos apagar o token: so o fazemos se o servidor disser explicitamente
  // que o token nao e valido (401). Em qualquer outro erro, tentamos de novo
  // com backoff e, enquanto isso, mostramos o ultimo utilizador conhecido.
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setReady(true);
      return;
    }

    // O utilizador guardado na ultima sessao (para nao ficar sem interface
    // enquanto o servidor nao responde).
    let guardado = null;
    try {
      guardado = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || "null");
    } catch {
      /* ignora: fica sem utilizador guardado */
    }
    if (guardado) setUser(guardado.user);

    let tentativas = 0;
    const maxTentativas = 3;
    const atrasos = [1000, 3000, 8000]; // ms

    function tentar() {
      api
        .me()
        .then((d) => {
          setUser(d.user);
          try {
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(d.user));
          } catch {
            /* sem localStorage: segue sem guardar */
          }
        })
        .catch((e) => {
          if (e.status === 401) {
            // O servidor diz que o token nao e valido: apaga-o.
            tokenStore.clear();
            setUser(null);
          } else if (tentativas < maxTentativas) {
            tentativas++;
            setTimeout(tentar, atrasos[tentativas - 1]);
          } else {
            // Esgotou as tentativas: mantem o utilizador guardado e nao limpa
            // o token. Pode ser uma falha temporaria da rede ou do servidor.
          }
        })
        .finally(() => setReady(true));
    }

    tentar();
  }, []);

  async function login(username, password) {
    const d = await api.login(username, password);
    tokenStore.set(d.token);
    try {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(d.user));
    } catch {
      /* sem localStorage: segue sem guardar */
    }
    setUser(d.user);
  }

  async function register(username, password) {
    const d = await api.register(username, password);
    tokenStore.set(d.token);
    try {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(d.user));
    } catch {
      /* sem localStorage: segue sem guardar */
    }
    setUser(d.user);
  }

  function logout() {
    tokenStore.clear();
    try {
      localStorage.removeItem(AUTH_USER_KEY);
    } catch {
      /* ignorar */
    }
    setUser(null);
  }

  async function updateAvatar(avatar) {
    const d = await api.updateProfile({ avatar });
    setUser(d.user);
  }

  // Actualiza o perfil (avatar, bio, privacidade) e devolve o utilizador novo.
  async function updateProfile(patch) {
    const d = await api.updateProfile(patch);
    setUser(d.user);
    return d.user;
  }

  return (
    <AuthContext.Provider
      value={{ user, ready, login, register, logout, updateAvatar, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
