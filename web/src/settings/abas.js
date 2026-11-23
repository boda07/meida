// Abas das Definições.
//
// Eram 21 seccoes num scroll so. Agora cada `<section className="set-section">`
// diz a que aba pertence (`data-tab="..."`) e o CSS esconde as das outras abas
// (ver `.settings-page[data-active-tab]` em styles.css) — assim nao foi preciso
// mexer no envelope nem na ordem dos blocos. O `id` de cada aba e' o mesmo
// string nos dois lados, por isso convem nao os escrever a mao.
//
// O `label` e' o TEXTO EM PORTUGUES, nao um rotulo ja' traduzido. Assim o `t()`
// consegue traduzi-lo no render (esta' const fora do componente, por isso nao
// pode chamar o `useT()` aqui).
export const TABS = [
  { id: "perfil", label: "Perfil" },
  { id: "aparencia", label: "Aparência" },
  { id: "reproducao", label: "Reprodução" },
  { id: "conteudo", label: "Conteúdo" },
  { id: "contas", label: "Contas" },
  { id: "dados", label: "Dados" },
  { id: "avancado", label: "Avançado" },
];