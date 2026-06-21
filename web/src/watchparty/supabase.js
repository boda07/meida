// Cliente Supabase (só para Realtime — canais de "broadcast" + "presence").
// As credenciais vem do build (Vite): VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
// A anon key e feita para ir no cliente; aqui só a usamos para realtime efemero
// (sem base de dados), por isso e seguro embuti-la no app.
import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client = null;

// Esta o Watch Party configurado neste build?
export function watchPartyEnabled() {
  return Boolean(URL && ANON);
}

// Cliente unico (lazy). Devolve null se não estiver configurado.
export function getSupabase() {
  if (!watchPartyEnabled()) return null;
  if (!client) {
    client = createClient(URL, ANON, {
      realtime: { params: { eventsPerSecond: 20 } },
      auth: { persistSession: false },
    });
  }
  return client;
}
