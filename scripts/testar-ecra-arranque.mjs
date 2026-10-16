// A app NAO pode esperar pelo servidor de dados para se mostrar.
//
// ---------------------------------------------------------------------------------
// A ASSERCAO CENTRAL DESTE FICHEIRO
// ---------------------------------------------------------------------------------
// **O `main.jsx` monta a aplicacao directamente: nao ha nada a envolver o `<App/>`
// que espere pelo servidor de dados.**
//
// O sintoma era: a app de desktop abria sempre com um ecra de espera ("o servidor
// de dados esta a acordar"), ~40 s de cada vez, com o servidor acordado. Duas
// coisas levavam a isso:
//
// 1. O ecra escondia a APLICACAO INTEIRA atras de um `fetch` ao servidor de dados.
//    A interface ja estava carregada — o servidor local tinha servido a pagina. O
//    que nao estava era um pedido de dados, e isso tem o seu proprio estado de
//    carregamento e o seu proprio erro, com a mensagem verdadeira.
//
// 2. Esse `fetch` nao tinha TEMPO LIMITE. Um pedido pendurado (ligacao aceite,
//    resposta que nao vem: IPv6 sem rota, VPN, portal cativo) nao entra no `.then()`
//    nem no `.catch()`, e a repeticao so estava no `.catch()`. Um pedido pendurado
//    significava ZERO novas tentativas: o ecra ficava preso para sempre a dizer
//    que o servidor dormia, sem o servidor ter nada a ver.
//
// Este teste e' sobre o QUE EXISTE e o que NAO existe. Nao ha React nem DOM: le
// os ficheiros e prova a forma. E' o suficiente, porque o que se poe um ecra a
// tapar a app e' visivel no fonte.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAIN = fs.readFileSync(path.join(RAIZ, "web", "src", "main.jsx"), "utf8");
const CLIENT = fs.readFileSync(path.join(RAIZ, "web", "src", "api", "client.js"), "utf8");
const TRAD = fs.readFileSync(path.join(RAIZ, "web", "src", "i18n", "traducoes.js"), "utf8");
const COMPONENTES = path.join(RAIZ, "web", "src", "components");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

console.log("");
console.log("  1) o main.jsx monta a app sem nada a tapar");
{
  ok_("o <App/> e' montado", /<App\s*\/>/.test(MAIN));
  // **A regra.** Nada a envolver o <App/> que espere pelo servidor de dados. O
  // `<App/>` tem de estar no nivel de cima do `root.render`, nao dentro de outro
  // elemento que so' o mostra quando um pedido responde.
  const app = MAIN.match(/<App\s*\/>/);
  ok_("o <App/> existe no ficheiro", !!app);
  const antes = app ? MAIN.slice(Math.max(0, app.index - 260), app.index) : "";
  // Se ele estivesse dentro de <AlgumaCoisa>, o `>` imediatamente antes seria de
  // opening tag e nao a fecho de um wrapper anterior.
  ok_("nao ha componente a envolver o <App/>", !/>\s*<[A-Z]/.test(antes), antes.slice(-70).trim());
  ok_("nao e' importado nenhum ecra de arranque", !/BootScreen/.test(MAIN.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "")));
  ok_("nao ha commento a prometer espera pelo servidor",
    !/Espera pelo servidor de dados antes de mostrar/.test(MAIN));
}

console.log("");
console.log("  2) o ecra de arranque nao existe");
{
  const ficheiro = path.join(COMPONENTES, "BootScreen.jsx");
  ok_("nao ha BootScreen.jsx em components/", !fs.existsSync(ficheiro), ficheiro);
  // E' a forma do ecrã que existia: quem mudar o ficheiro tem de mudar isto.
  ok_("nenhum ficheiro volta a falar do ecra de arranque",
    !fs.readdirSync(COMPONENTES).some((f) => /Boot|Arranq/i.test(f)),
    fs.readdirSync(COMPONENTES).filter((f) => /Boot|Arranq/i.test(f)).join(", "));
  ok_("nenhum ficheiro de codigo importa BootScreen", !/from ["'][^"']*BootScreen/.test(MAIN));
}

console.log("");
console.log("  3) nao sobrou o pedido ao servidor de dados que o ecra usava");
{
  // `healthDados` so' existia para o ecra. Fica-lo e' codigo morto que da a
  // impressao errada de que ainda ha uma espera algures.
  ok_("o cliente ja nao tem healthDados", !/healthDados/.test(CLIENT));
  ok_("o cliente ja nao tem o helper do tempo limite", !/fetchComTempo|TEMPO_HEALTH/.test(CLIENT));
  ok_("o health local continua a existir", /health: \(\) => get\("\/api\/health"\)/.test(CLIENT));
}

console.log("");
console.log("  4) as mensagens do ecra de arranque foram removidas das traducoes");
{
  // Deixadas no dicionario, nao custam nada — mas sao 7 textos que ninguem pode
  // encontrar, e o proximo que mexer no ficheiro nao sabe que foram deitados fora.
  const obsolete = [
    "A ligar ao servidor",
    "O servidor está a acordar",
    "Ainda a tentar. Se não abrir",
    "Os teus dados ficam guardados no servidor",
    "Não conseguimos resposta do servidor de dados",
    "Verifica a internet",
  ];
  for (const t of obsolete) {
    ok_('fora: "' + t.slice(0, 38) + '"', !TRAD.includes(t), "ainda esta no dicionario");
  }
}

console.log("");
console.log("  5) o ecra ESTATICO do index.html fica (esse e' legitimo)");
{
  // Distinguir os dois e' o ponto: o estatico sai quando o JS arranca (um
  // segundo), e diz "a app esta a arrancar" — verdade. O outro esperava por um
  // pedido de dados. Deixar o primeiro e' o que evita o ecra preto.
  const INDEX = fs.readFileSync(path.join(RAIZ, "web", "index.html"), "utf8");
  ok_("o index.html ainda tem o ecra estatico", /id=["']boot["']/.test(INDEX));
  ok_("e o main.jsx tira-o ao montar", /getElementById\("boot"\)\?\.remove\(\)/.test(MAIN));
}

console.log("");
console.log("  6) higiene");
{
  const tudo = MAIN + CLIENT + TRAD;
  ok_("sem caracteres CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(tudo));
  ok_("sem caractere de substituicao", !/[\uFFFD]/.test(tudo));
  ok_("sem palavra inglesa escrita dentro de um comentario",
    !/truthful/.test(MAIN));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);