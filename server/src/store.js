// Ponto de entrada do store.
//
// O codigo vive em `store/` e cada ficheiro tem UMA responsabilidade (SRP):
// utilizadores, biblioteca, progresso, listas, social, notificacoes, comentarios
// e tokens. Este ficheiro junta as pecas para as rotas continuarem a importar de
// `../store.js`, como sempre fizeram.
//
// Nao mexer aqui sem acrescentar o modulo correspondente: um `export *` a menos
// e' um import a menos que rebenta no arranque.
export * from "./store/users.js";
export * from "./store/tokens.js";
export * from "./store/library.js";
export * from "./store/progress.js";
export * from "./store/lists.js";
export * from "./store/social.js";
export * from "./store/notifications.js";
export * from "./store/comments.js";