import { createContext, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // Ao arrancar, se houver token guardado, valida-o e recupera o utilizador.
  useEffect(() => {
    if (!tokenStore.get()) {
      setReady(true);
      return;
    }
    api
      .me()
      .then((d) => setUser(d.user))
      .catch(() => tokenStore.clear())
      .finally(() => setReady(true));
  }, []);

  async function login(username, password) {
    const d = await api.login(username, password);
    tokenStore.set(d.token);
    setUser(d.user);
  }

  async function register(username, password) {
    const d = await api.register(username, password);
    tokenStore.set(d.token);
    setUser(d.user);
  }

  function logout() {
    tokenStore.clear();
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
