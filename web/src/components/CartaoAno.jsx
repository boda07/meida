// O cartao de partilha "o teu ano". Desenhado num <canvas> e guardado como PNG.
//
// ---------------------------------------------------------------------------------
// PORQUE CANVAS, E NAO "FORA DO BROWSER"
// ---------------------------------------------------------------------------------
// A ideia original dizia que isto "depende de gerar fora do browser". Nao
// depende: a app e' Electron **e** site, e o canvas corre igual nos dois.
// Gerar fora exigiria um canal IPC novo no Electron e nao funcionaria na
// versao web (meida.onrender.com) — trocava-se um problema por dois.
//
// O canvas do browser tem dois enigmas reais, e os dois estao resolvidos aqui:
//
//   1. **A fonte.** Se se desenhar antes do peso estar carregado, o canvas cai
//      para a fonte do sistema EM SILENCIO. Medido: `Archivo 700` e `Archivo 900`
//      estavam `unloaded`. Por isso `carregaFontes()` espera por cada peso que o
//      desenho usa, e nao so por `document.fonts.ready`.
//
//   2. **O retina.** `devicePixelRatio` era 1.25 no ecra de teste. A solucao e'
//      `escalaRetina()`: o canvas e' criado grande e o contexto e' reduzido com
//      `scale()`, para todas as coordenadas do desenho serem em px de CSS.
//
// E ha um terceiro, que a ideia nao mencionava e que rebenta tudo: **os cartazes
// tornam o canvas "tainted"**. Se um `drawImage()` vier de um host sem CORS, o
// `toBlob()` lanca `SecurityError` e nao ha PNG. O CDN do TMDB e o do MAL
// mandam `access-control-allow-origin: *` (medido), mas so se pedir a imagem
// com `crossOrigin="anonymous"` — por isso `carregaImagem()` faz isso, e uma
// imagem que falhe e' simplesmente saltada em vez de estragar o cartao.
import { useRef, useState } from "react";
import { useT } from "../i18n/I18nContext.jsx";
import {
  CARTAO_L,
  CARTAO_A,
  escalaRetina,
  mesesDoAno,
  mesMaisOcupado,
  alturasDosMeses,
  tamanhoQueCabe,
  nomeDoFicheiro,
  fonteDe,
} from "./cartao.js";
// `anoDaMeta` e' a mesma funcao que a meta usa — e' ela que escolhe o ano do
// relogio de quem ve, e nao o do servidor (ver server/src/metas.js).
import { anoDaMeta } from "./metas.js";

/**
 * Espera que os pesos que o desenho usa estejam carregados.
 *
 * `document.fonts.ready` sozinho NAO chega: resolve quando as fontes **que
 * precisam** de estar prontas estão, e uma fonte que ninguem desenhou na pagina
 * pode ficar `unloaded` sem que o `ready` espere por ela. Por isso pede-se cada
 * peso pelo nome.
 *
 * @returns true se ficou tudo pronto, false se alguma nao carregou a tempo. A
 *   funcao nao rebenta: um cartao na fonte errada e' melhor do que nenhum cartao,
 *   e quem vai ver diz-me na mesma que saiu com a fonte do sistema.
 */
export async function carregaFontes(doc = document, comTimeoutMs = 3000) {
  const f = doc.fonts;
  if (!f) return false;
  const pesos = [fonteDe("800", 48, "titulo"), fonteDe("700", 40, "titulo"), fonteDe("600", 32), fonteDe("400", 28)];
  const espera = pesos.map((p) => f.load(p).catch(() => null));
  // Sem isto, uma fonte que nunca chega (Google Fonts bloqueado, offline) deixa
  // a promessa pendurada e o botao fica a "a desenhar..." para sempre.
  const limite = new Promise((r) => setTimeout(() => r("timeout"), comTimeoutMs));
  const resultado = await Promise.race([Promise.all(espera).then(() => "ok"), limite]);
  return resultado === "ok";
}

/**
 * Carrega uma imagem para o canvas SEM o tainted.
 *
 * O `crossOrigin` tem de estar no `img` **antes** do `src`. Se se puser depois,
 * o browser ignora e a imagem fica "opaca", o canvas suja e o `toBlob` rebenta.
 */
export function carregaImagem(url, doc = document, comTimeoutMs = 6000) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new doc.defaultView.Image();
    let acabou = false;
    const fim = (v) => {
      if (acabou) return;
      acabou = true;
      resolve(v);
    };
    const t = setTimeout(() => fim(null), comTimeoutMs);
    img.onload = () => {
      clearTimeout(t);
      fim(img);
    };
    img.onerror = () => {
      clearTimeout(t);
      fim(null);
    };
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

/** Um numero com o separador de milhares, como a pessoa o ve na app. */
function numero(n) {
  return new Intl.NumberFormat("pt-PT").format(Math.max(0, Number(n) || 0));
}

/**
 * Desenha o cartao e devolve o PNG como Blob.
 *
 * PURE quanto ao que recebe (um canvas e os numeros); e' o `ctx` que faz o
 * resto. Separar o desenho da execucao e' o que permite testar os numeros sem
 * um browser.
 *
 * @param canvas  ja criado no tamanho de `escalaRetina()`
 * @param d       {ano, titulos, dias, top, username, acento}
 * @returns {blob}
 */
export async function desenhaCartao(canvas, d, doc = document) {
  const { escala } = escalaRetina(CARTAO_L, doc.defaultView.devicePixelRatio || 1);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(escala, 0, 0, escala, 0, 0);

  const ano = d.ano;
  const marcados = d.marcados;
  const diasActivos = d.diasActivos;
  const meses = mesesDoAno(d.dias, ano);
  const alturas = alturasDosMeses(meses);
  const pico = mesMaisOcupado(meses);

  // Fundo escuro com uma faixa do acento. A cor vem do que a pessoa escolheu nas
  // definicoes — e' a MESMA variavel que o resto da app usa, para o cartao nao
  // parecer de outra aplicacao.
  ctx.fillStyle = "#0b0b0d";
  ctx.fillRect(0, 0, CARTAO_L, CARTAO_A);
  ctx.fillStyle = d.acento || "#c90303";
  ctx.fillRect(0, 0, CARTAO_L, 14);

  const margem = 90;

  // "O TEU ANO"
  ctx.fillStyle = "#8b8b96";
  ctx.font = fonteDe("700", 40, "titulo");
  // Sem fallback em portugues: se a string nao vier, nao se escreve nada. Um
  // `|| "O teu ano"` punha o cartao em portugues com a app em ingles.
  if (d.tituloCartao) ctx.fillText(d.tituloCartao, margem, 190);

  // O ano, enorme.
  ctx.fillStyle = "#ffffff";
  const tamAno = tamanhoQueCabe(String(ano), CARTAO_L - margem * 2, 190, 90);
  ctx.font = fonteDe("800", tamAno, "titulo");
  ctx.fillText(String(ano), margem, 190 + tamAno);

  // A linha do nome, por baixo do ano.
  ctx.fillStyle = "#8b8b96";
  ctx.font = fonteDe("400", 28);
  ctx.fillText("@" + (d.username || ""), margem, 190 + tamAno + 56);

  // As duas cifras grandes.
  const linhaY = 190 + tamAno + 190;
  ctx.fillStyle = "#ffffff";
  const tam1 = tamanhoQueCabe(numero(marcados), 300, 132);
  ctx.font = fonteDe("800", tam1, "titulo");
  ctx.fillText(numero(marcados), margem, linhaY);
  ctx.fillStyle = "#8b8b96";
  ctx.font = fonteDe("600", 32);
  if (d.rotuloMarcados) ctx.fillText(d.rotuloMarcados, margem, linhaY + 48);

  const col2 = margem + 440;
  ctx.fillStyle = "#ffffff";
  const tam2 = tamanhoQueCabe(numero(diasActivos), 300, 132);
  ctx.font = fonteDe("800", tam2, "titulo");
  ctx.fillText(numero(diasActivos), col2, linhaY);
  ctx.fillStyle = "#8b8b96";
  ctx.font = fonteDe("600", 32);
  if (d.rotuloDias) ctx.fillText(d.rotuloDias, col2, linhaY + 48);

  // A faixa dos 12 meses.
  const base = linhaY + 170;
  const larguraFaixa = CARTAO_L - margem * 2;
  const passo = larguraFaixa / 12;
  const alturaBarra = 130;
  for (let i = 0; i < 12; i++) {
    const h = alturas[i] * alturaBarra;
    const x = margem + i * passo + 8;
    const w = passo - 16;
    // O mes do pico leva o acento: e' o que faz a faixa ter um foco, e o que
    // diz "aqui foi quando".
    ctx.fillStyle = i === pico && meses[i] && meses[i].n > 0 ? d.acento || "#c90303" : "#2a2a31";
    // As pontas arredondadas: `roundRect` nao existe em todo o lado, e um
    // `rect` com raio e' a unica forma de o drawing ficar igual em todo o sitio.
    arredonda(ctx, x, base + alturaBarra - h, w, h, Math.min(6, w / 2));
    ctx.fill();
  }
  // O nome do mes do pico, se houver.
  if (pico >= 0 && meses[pico] && meses[pico].n > 0) {
    ctx.fillStyle = "#8b8b96";
    ctx.font = fonteDe("600", 30);
    if (d.rotuloPico) ctx.fillText(d.rotuloPico + ": " + meses[pico].rotulo, margem, base + alturaBarra + 54);
  }

  // Os cartazes. Vem DEPOIS do texto e nao antes: uma imagem que falha tem de
  // deixar o resto do cartao intacto, e o texto e' o que nao pode faltar.
  const top = Array.isArray(d.top) ? d.top : [];
  const imgTop = base + alturaBarra + 110;
  const larguraImg = 220;
  const alturaImg = 330;
  let x = margem;
  for (const t of top.slice(0, 3)) {
    const img = await carregaImagem(t.poster, doc);
    if (img && img.naturalWidth > 0) {
      ctx.save();
      arredonda(ctx, x, imgTop, larguraImg, alturaImg, 10);
      ctx.clip();
      // `cover`: cobre a caixa sem esticar. Um cartaz e' 2:3 e a caixa e' 2:3,
      // mas a imagem pode nao ser, e esticar um cartaz parece um erro.
      const r = Math.max(larguraImg / img.naturalWidth, alturaImg / img.naturalHeight);
      const w = img.naturalWidth * r;
      const h = img.naturalHeight * r;
      ctx.drawImage(img, x + (larguraImg - w) / 2, imgTop + (alturaImg - h) / 2, w, h);
      ctx.restore();
    } else {
      // Sem cartaz: um bloco com a cor da pista, para o alinhamento nao mudar.
      ctx.fillStyle = "#1a1a1f";
      arredonda(ctx, x, imgTop, larguraImg, alturaImg, 10);
      ctx.fill();
    }
    x += larguraImg + 30;
  }

  // A legenda da fonte, discreta. Nao e' vaidade: sem isto quem ve a imagem nao
  // sabe de que app e' — e e' o que faz a partilha voltar.
  ctx.fillStyle = "#5a5a64";
  ctx.font = fonteDe("400", 26);
  ctx.fillText(d.assinatura || "MEIDA", CARTAO_L - margem - 180, CARTAO_A - 60);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas-toBlob-null"))),
      "image/png"
    );
  });
}

/** `roundRect` em polyfill: existe em todo o sitio, mas nao em todo o sitio. */
function arredonda(ctx, x, y, w, h, r) {
  const raio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, raio);
    return;
  }
  ctx.moveTo(x + raio, y);
  ctx.arcTo(x + w, y, x + w, y + h, raio);
  ctx.arcTo(x + w, y + h, x, y + h, raio);
  ctx.arcTo(x, y + h, x, y, raio);
  ctx.arcTo(x, y, x + w, y, raio);
  ctx.closePath();
}

/**
 * O botao que gera e baixa a imagem.
 *
 * O `canvas` nao esta no DOM de proposito: e' um alvo de desenho, e um canvas
 * visivel de 1080x1350 dentro da pagina seria um bloco gigante. O que se ve e
 * um botao.
 */
export default function CartaoAno({ stats, username, acento }) {
  const t = useT();
  const ref = useRef(null);
  const [estado, setEstado] = useState("idle");

  const ano = new Date().getFullYear();
  const marcados = anoDaMeta(stats?.filmesPorAno, ano);
  const dias = stats?.dias || [];
  const diasActivos = dias.filter((d) => d && String(d.dia || "").startsWith(String(ano))).length;

  const gerar = async () => {
    setEstado("a");
    try {
      await carregaFontes();
      const { largura, altura } = escalaRetina(CARTAO_L, window.devicePixelRatio || 1);
      const canvas = ref.current || document.createElement("canvas");
      canvas.width = largura;
      canvas.height = altura;
      ref.current = canvas;
      const blob = await desenhaCartao(canvas, {
        ano,
        marcados,
        dias,
        diasActivos,
        top: stats?.topDoAno || [],
        username,
        acento: acento || "#c90303",
        tituloCartao: t("O teu ano"),
        rotuloMarcados: t("títulos marcados como vistos"),
        rotuloDias: t("dias com atividade"),
        rotuloPico: t("mais ativo em"),
        assinatura: "MEIDA",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeDoFicheiro(ano);
      a.click();
      // O `revokeObjectURL` tem de ser DEPOIS do clique: arevogar logo liberta
      // o blob antes de o browser começar a lê-lo, e o ficheiro vai de 0 bytes.
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setEstado("ok");
    } catch {
      // O "tainted" e' o erro que o `desenhaCartao` pode largar se alguma
      // imagem nao veio com CORS. Falhar aqui e' melhor do que descarregar um
      // PNG de 0 bytes sem dizer nada.
      setEstado("erro");
    }
  };

  return (
    <>
      <canvas ref={ref} className="cartao-ano-canvas" aria-hidden="true" />
      <button type="button" className="cartao-ano-btn" onClick={gerar} disabled={estado === "a"}>
        {estado === "a" ? t("A desenhar…") : estado === "ok" ? t("Descarregado") : estado === "erro" ? t("Não consegui desenhar") : t("Cartão do teu ano")}
      </button>
      {estado === "erro" && (
        <p className="cartao-ano-erro muted">{t("Não consegui gerar a imagem. Uma das imagens não deixou o desenho ser exportado.")}</p>
      )}
    </>
  );
}