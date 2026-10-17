// Limite de pedidos, em memoria.
// E' o que atrasa um ataque de brute force no /auth/login e o spam de contas no
// /auth/register. Na app de desktop o servidor so atende um utilizador (estes
// limites nunca chegam a ser atingidos em uso normal); no servidor publico
// (fadehost) e' esta camada que impede o login de ser um alvo.
//
// Guarda um contador por chave (ip + rota) numa janela de tempo. Quando a janela
// expira, o contador recomeca. E' intencionalmente simples: nao precisa de Redis
// nem de nenhuma dependencia nova, e o preço e' que o contador se perde quando o
// servidor reinicia — aceitavel, porque o objetivo e' atrasar, nao bloquear a
// prova absoluta.
//
// O mapa e' limpo a cada 10 minutos para nao crescer sem teto num servidor que
// fica ligado meses. O timer usa `.unref()` para nao segurar o processo vivo
// (importante na app de desktop, onde o processo e' a janela da app).
const janelas = new Map(); // (ip, rota) -> { conta, expira }

// Falhas de login por (ip, username). Independente do rateLimiter acima: mesmo
// que o IP nao tenha excedido o limite geral, FALHAS_MAX falhas seguidas para a
// mesma conta bloqueiam essa combinacao durante BLOQUEIO_MS. Isto evita:
//   - um ataque distribuido (varios IPs a tentar a mesma senha);
//   - um ataque a uma conta especifica (tentar milhares de senhas numa so).
const falhasLogin = new Map(); // (ip, username) -> { conta, expira }
const FALHAS_MAX = 10; // 10 tentativas falhadas por (ip, utilizador) bloqueiam durante 15 min
const BLOQUEIO_MS = 15 * 60 * 1000;

const LIMPEZA_MS = 10 * 60 * 1000;
let timerLimpeza = null;
function garantirLimpeza() {
  if (timerLimpeza) return;
  timerLimpeza = setInterval(() => {
    const agora = Date.now();
    for (const [chave, { expira }] of janelas) {
      if (agora > expira) janelas.delete(chave);
    }
    for (const [chave, { expira }] of falhasLogin) {
      if (agora > expira) falhasLogin.delete(chave);
    }
  }, LIMPEZA_MS);
  timerLimpeza.unref?.();
}

// Middleware: no maximo `max` pedidos por (ip, rota) numa janela de `windowMs`.
// Quando excedido, responde 429 com um `Retry-After` em segundos.
export function rateLimiter(max, windowMs) {
  garantirLimpeza();
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "desconhecido";
    const chave = ip + ":" + req.path;
    const agora = Date.now();
    let entrada = janelas.get(chave);
    if (!entrada || agora >= entrada.expira) {
      entrada = { conta: 0, expira: agora + windowMs };
      janelas.set(chave, entrada);
    }
    entrada.conta += 1;
    if (entrada.conta > max) {
      res.set("Retry-After", Math.ceil((entrada.expira - agora) / 1000));
      return res.status(429).json({ error: "Muitos pedidos. Tenta de novo mais tarde." });
    }
    next();
  };
}

function chaveFalha(ip, username) {
  return ip + ":" + String(username || "").toLowerCase();
}

// Regista uma falha de login. Devolve o numero de falhas acumuladas na janela.
export function registarFalhaLogin(ip, username) {
  const chave = chaveFalha(ip, username);
  const agora = Date.now();
  let entrada = falhasLogin.get(chave);
  if (!entrada || agora >= entrada.expira) {
    entrada = { conta: 0, expira: agora + BLOQUEIO_MS };
    falhasLogin.set(chave, entrada);
  }
  entrada.conta += 1;
  return entrada.conta;
}

// Devolve true se (ip, username) esta bloqueado por falhas repetidas (>= FALHAS_MAX).
export function estaBloqueadoLogin(ip, username) {
  const entrada = falhasLogin.get(chaveFalha(ip, username));
  return !!entrada && entrada.conta >= FALHAS_MAX && Date.now() < entrada.expira;
}
