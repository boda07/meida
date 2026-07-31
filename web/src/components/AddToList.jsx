import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";

// Botao "Adicionar a lista": abre um menu com as listas do utilizador (+ criar
// nova). Ao escolher uma lista, adiciona o titulo atual a essa lista.
export default function AddToList({ details }) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState([]);
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    api
      .lists()
      .then((d) => setLists(d.lists))
      .catch(() => {});
  }, [open]);

  // Fecha ao clicar fora ou com Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function add(listId, name) {
    setBusy(true);
    setMsg(null);
    try {
      await api.addListTitle(listId, {
        tmdbId: details.id,
        type: details.type,
        title: details.title,
        poster: details.poster,
      });
      setMsg(`Adicionado a "${name}"`);
      setTimeout(() => {
        setOpen(false);
        setMsg(null);
      }, 900);
    } catch {
      setMsg("Falhou ao adicionar.");
    } finally {
      setBusy(false);
    }
  }

  async function createAndAdd() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setMsg(null);
    try {
      const { list } = await api.createList(name);
      setLists((prev) => [list, ...prev]);
      setNewName("");
      await add(list.id, list.name);
    } catch {
      setMsg("Falhou ao criar a lista.");
      setBusy(false);
    }
  }

  return (
    <div className="addtolist" ref={ref}>
      <button
        type="button"
        className="lib-trailer"
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
      >
        + Lista
      </button>
      {open && (
        <div className="addtolist-menu">
          {msg ? (
            <p className="addtolist-msg">{msg}</p>
          ) : (
            <>
              <p className="addtolist-hint">Adicionar a que lista?</p>
              {lists.length ? (
                <div className="addtolist-lists">
                  {lists.map((l) => (
                    <button
                      key={l.id}
                      className="addtolist-item"
                      disabled={busy}
                      onClick={() => add(l.id, l.name)}
                    >
                      {l.name}
                      <span className="muted">{l.count}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">Ainda nao tens listas.</p>
              )}
              <div className="addtolist-new">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
                  placeholder="Nome da nova lista"
                  maxLength={60}
                />
                <button
                  className="modal-btn ghost"
                  disabled={busy || !newName.trim()}
                  onClick={createAndAdd}
                >
                  Criar e adicionar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
