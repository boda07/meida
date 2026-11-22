// Config ESLint (flat, v10). Foco em APANHAR BUGS (variaveis nao usadas, erros
// comuns, hooks fora de regra) — nao em estilo (aspas/ponto-e-virgula ficam
// livres). O objetivo: as regras `error` dão zero no `npm run lint`.
// Alvo: server (Node), web (React), electron, scripts e raiz.
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "release/**",
      "web/dist/**",
      "server/data/**",
      "server/src/data/**",
    ],
  },
  js.configs.recommended,
  {
    rules: {
      // Regras que apanham bugs reais.
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none", varsIgnorePattern: "^_" }],
      "prefer-const": "error",
      "no-var": "error",
      "no-useless-escape": "error",
      "no-async-promise-executor": "error",
      "no-cond-assign": "error",
      "no-constant-condition": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "no-prototype-builtins": "error",
      // Logs são intencionais no servidor; sem bloqueio em lado nenhum.
      "no-console": "off",
    },
  },
  // Node: servidor, scripts e ficheiros da raiz (ESM).
  {
    files: ["server/**/*.js", "scripts/**/*.mjs", "*.js", "*.mjs"],
    languageOptions: { globals: globals.node, sourceType: "module" },
  },
  // Electron e build scripts (CommonJS).
  {
    files: ["electron/**/*.cjs", "build/**/*.cjs", "scripts/**/*.cjs"],
    languageOptions: { globals: globals.node },
  },
  // Web: React (browser) com as regras de hooks. JSX via espree.
  {
    files: ["web/**/*.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.browser, __APP_VERSION__: "readonly" },
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  // Web: páginas e componentes são desenho. Os dados (API) e as preferências
  // (`web/src/storage/`) vêm por ganchos e contextos — não por `fetch` nem
  // `localStorage` espalhados pelo JSX. É a mesma regra do
  // `scripts/testar-solid.mjs`, que apanha o que o ESLint não consegue (o
  // `addEventListener`, que é um método do elemento e não uma propriedade global).
  {
    files: ["web/src/pages/**/*.jsx", "web/src/components/*.jsx"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Usa um store de web/src/storage/ (DIP)." },
        { name: "sessionStorage", message: "Usa um store de web/src/storage/ (DIP)." },
        { name: "fetch", message: "Usa o api de web/src/api/client.js (DIP)." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "localStorage", message: "Usa um store de web/src/storage/ (DIP)." },
        { object: "window", property: "fetch", message: "Usa o api de web/src/api/client.js (DIP)." },
        { object: "document", property: "addEventListener", message: "Usa useClickOutside/useTeclaEsc/... (DIP)." },
        { object: "window", property: "addEventListener", message: "Usa useClickOutside/useTeclaEsc/... (DIP)." },
      ],
    },
  },
];
