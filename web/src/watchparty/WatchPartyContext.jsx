import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

const WatchPartyContext = createContext(null);

// Codigo de sala curto e legivel (sem caracteres ambiguos).
function makeCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

// Mesma base de URL da API (runtime-config.json / same-origin).
const API_ORIGIN = (typeof window !== "undefined" && window.MEIDA_API_BASE) || "";
function fullUrl(path) {
  return API_ORIGIN ? `${API_ORIGIN}${path}` : `${window.location.origin}${path}`;
}

export function WatchPartyProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [room, setRoom] = useState(null); // codigo da sala (null = sem sala)
  const [nick, setNick] = useState("");
  const [members, setMembers] = useState([]); // [{nick}]
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState(null);

  const esRef = useRef(null); // EventSource da sala
  const openedRef = useRef(false); // a ligacao chegou a abrir?
  const idRef = useRef(Math.random().toString(36).slice(2)); // id deste cliente
  const roomRef = useRef(null); // codigo da sala sempre atualizado (para closures)
  const handlersRef = useRef(new Set()); // subscritores de eventos
  const suppressNavRef = useRef(false); // evita reenviar nav aplicada do remoto
  const pathRef = useRef(location.pathname + location.search);
  const hostRef = useRef(false); // se este cliente e o host (estavel no canal)

  // Envia um evento para a sala (POST ao servidor, que difunde aos outros).
  const send = useCallback((kind, data) => {
    const code = roomRef.current;
    if (!code) return;
    fetch(fullUrl("/api/wp/send"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: code, from: idRef.current, kind, data }),
    }).catch(() => {});
  }, []);

  // Subscreve eventos recebidos. Devolve funcao para cancelar.
  const subscribe = useCallback((handler) => {
    handlersRef.current.add(handler);
    return () => handlersRef.current.delete(handler);
  }, []);

  // Evento "real" vindo de outro cliente (via SSE).
  const handleRemote = useCallback(
    (payload) => {
      if (!payload || payload.from === idRef.current) return;
      // Navegacao: o contexto trata da rota; o resto vai aos subscritores.
      if (payload.kind === "nav") {
        const path = payload.data?.path;
        if (path && path !== pathRef.current) {
          suppressNavRef.current = true;
          navigate(path);
        }
        return;
      }
      if (payload.kind === "hello") {
        // Um membro novo entrou: o host reenvia a rota ONDE ESTA AGORA.
        if (hostRef.current) send("nav", { path: pathRef.current });
        return;
      }
      for (const h of handlersRef.current) h(payload);
    },
    [navigate, send]
  );

  // Cada mensagem do SSE.
  const handleStream = useCallback(
    (msg) => {
      if (msg.type === "members") setMembers(msg.members || []);
      else handleRemote(msg);
    },
    [handleRemote]
  );

  // Liga-se a uma sala (cria ou junta) via EventSource. A presenca e o proprio
  // stream: fechar = sair. O EventSource religa sozinho se cair.
  const connect = useCallback(
    (code, nickname, host) => {
      setError(null);
      hostRef.current = host;
      roomRef.current = code;
      openedRef.current = false;

      esRef.current?.close();
      setRoom(code);
      setNick(nickname);
      setIsHost(host);
      setMembers([]);

      const es = new EventSource(
        fullUrl(
          `/api/wp/stream?room=${encodeURIComponent(code)}&client=${encodeURIComponent(idRef.current)}&nick=${encodeURIComponent(nickname)}`
        )
      );
      es.onopen = () => {
        openedRef.current = true;
      };
      es.onmessage = (e) => {
        try {
          handleStream(JSON.parse(e.data));
        } catch {
          // mensagem malformada: ignora
        }
      };
      es.onerror = () => {
        // Se nunca chegou a ligar (server em baixo), avisa uma vez.
        if (!openedRef.current) {
          setTimeout(() => {
            if (!openedRef.current) setError("Sem ligação ao Watch Party.");
          }, 4000);
        }
      };
      esRef.current = es;

      if (!host) send("hello", {});
    },
    [handleStream, send]
  );

  const createRoom = useCallback(
    (nickname) => {
      const code = makeCode();
      connect(code, nickname || "Host", true);
      return code;
    },
    [connect]
  );

  const joinRoom = useCallback(
    (code, nickname) =>
      connect(String(code).toUpperCase().trim(), nickname || "Convidado", false),
    [connect]
  );

  const leave = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    hostRef.current = false;
    roomRef.current = null;
    setRoom(null);
    setMembers([]);
    setIsHost(false);
    setNick("");
  }, []);

  // Propaga a navegacao local para a sala (a menos que tenha vindo do remoto).
  useEffect(() => {
    pathRef.current = location.pathname + location.search;
    if (!room) return;
    if (suppressNavRef.current) {
      suppressNavRef.current = false;
      return;
    }
    send("nav", { path: pathRef.current });
  }, [location.pathname, location.search, room, send]);

  // Limpeza ao desmontar.
  useEffect(() => () => leave(), [leave]);

  const value = {
    enabled: true, // agora usa o proprio servidor, sem Supabase
    active: Boolean(room),
    room,
    nick,
    members,
    isHost,
    error,
    createRoom,
    joinRoom,
    leave,
    send,
    subscribe,
  };

  return (
    <WatchPartyContext.Provider value={value}>
      {children}
    </WatchPartyContext.Provider>
  );
}

export function useWatchParty() {
  return useContext(WatchPartyContext);
}