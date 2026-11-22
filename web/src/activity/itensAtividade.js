// Regras da LISTA de atividade, sem React.
//
// A paginação é por `offset` (o servidor não sabe o que o cliente já desenhou) e
// uma atividade nova no topo desloca tudo: a página seguinte passa a começar na
// que já estava no fim da anterior. `juntarPagina` junta só o que é novo, para
// não aparecer duas vezes.
export function juntarPagina(base, pagina) {
  const atual = Array.isArray(base) ? base : [];
  const novos = Array.isArray(pagina) ? pagina : [];
  const vistos = new Set(atual.map((x) => x.id));
  return [...atual, ...novos.filter((x) => !vistos.has(x.id))];
}