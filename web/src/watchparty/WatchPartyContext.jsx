import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSupabase, watchPartyEnabled } from "./supabase.js";

const WatchPartyContext = createContext(null);

// Codigo de sala curto e legivel (sem caracteres ambiguos).
function makeCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

export function WatchPartyProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [room, setRoom] = useState(null); // codigo da sala (null = sem sala)
  const [nick, setNick] = useState("");
  const [members, setMembers] = useState([]); // [{nick}]
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState(null);

  const channelRef = useRef(null);
  const idRef = useRef(Math.random().toString(36).slice(2)); // id deste cliente
  const handlersRef = useRef(new Set()); // subscritores de eventos
  const suppressNavRef = useRef(false); // evita reenviar nav aplicada do remoto
  // Caminho atual SEMPRE atualizado (o handler do canal e criado uma vez e nao
  // veria as navegacoes seguintes). Usado para responder ao "hello" com a rota
  // onde o host esta AGORA — senao um membro que entra depois vai parar a home.
  const pathRef = useRef(location.pathname + location.search);
  const hostRef = useRef(false); // se este cliente e o host (estavel no canal)

  // Envia um evento para a sala.
  const send = useCallback((kind, data) => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({
      type: "broadcast",
      event: "msg",
      payload: { kind, data, from: idRef.current },
    });
  }, []);

  // Subscreve eventos recebidos. Devolve funcao para cancelar.
  const subscribe = useCallback((handler) => {
    handlersRef.current.add(handler);
    return () => handlersRef.current.delete(handler);
  }, []);

  // Sai da sala atual.
  const leave = useCallback(() => {
    const ch = channelRef.current;
    if (ch) getSupabase()?.removeChannel(ch);
    channelRef.current = null;
    hostRef.current = false;
    setRoom(null);
    setMembers([]);
    setIsHost(false);
  }, []);

  // Liga-se a um canal de sala (cria ou junta).
  const connect = useCallback(
    (code, nickname, host) => {
      const supabase = getSupabase();
      if (!supabase) {
        setError("Watch Party não configurado neste app.");
        return;
      }
      setError(null);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      hostRef.current = host;

      const ch = supabase.channel(`wp-${code}`, {
        config: { broadcast: { self: false }, presence: { key: idRef.current } },
      });

      ch.on("broadcast", { event: "msg" }, ({ payload }) => {
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
        }
        for (const h of handlersRef.current) h(payload);
      });

      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState();
        const list = Object.values(state).flatMap((arr) =>
          arr.map((m) => ({ nick: m.nick || "?" }))
        );
        setMembers(list);
      });

      ch.subscribe(async (st) => {
        if (st === "SUBSCRIBED") {
          await ch.track({ nick: nickname });
          if (!host) send("hello", {});
        }
      });

      channelRef.current = ch;
      setRoom(code);
      setNick(nickname);
      setIsHost(host);
    },
    [navigate, send]
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
    (code, nickname) => connect(String(code).toUpperCase().trim(), nickname || "Convidado", false),
    [connect]
  );

  // Propaga a navegacao local para a sala (a menos que tenha vindo do remoto).
  // Mantem tambem o pathRef atualizado para o handler do canal e o "hello".
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
    enabled: watchPartyEnabled(),
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
