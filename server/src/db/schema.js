// Schema da base de dados, como migracoes numeradas.
//
// ── NOTA IMPORTANTE SOBRE OS IDs ────────────────────────────────────────────
// A coluna chama-se `external_id` e NAO `tmdb_id` de proposito. A app trata
// "anime" pelo id do MyAnimeList, nao pelo do TMDB (ver services/mal.js:
// `tmdbId: node.id, // id do MAL`). Ou seja, `external_id` vale:
//
//     media_type='movie' | 'tv'  ->  id do TMDB
//     media_type='anime'         ->  id do MAL
//
// A API continua a expor isto ao frontend como `tmdbId` (nome historico que
// ja esta em todo o lado) — so o nome interno da coluna e' honesto. Misturar
// os dois sistemas num unico campo sem documentar era a forma facil de meter
// um id do MAL a colidir com um id do TMDB.
export const MIGRATIONS = [
  {
    version: 1,
    name: "base",
    up(db) {
      db.exec(`
        CREATE TABLE users (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT    NOT NULL,
          avatar        TEXT,
          created_at    TEXT    NOT NULL
        );

        -- Tokens de servicos externos (MAL, AniList, Letterboxd, Real-Debrid).
        -- Antes viviam como campos dentro do utilizador no JSON; agora ficam
        -- normalizados numa linha por (utilizador, servico).
        CREATE TABLE user_tokens (
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider   TEXT    NOT NULL,   -- mal | anilist | letterboxd | debrid
          payload    TEXT,               -- JSON (tokens, username, etc.)
          updated_at TEXT    NOT NULL,
          PRIMARY KEY (user_id, provider)
        );

        CREATE TABLE library (
          user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          media_type   TEXT    NOT NULL,   -- movie | tv | anime
          external_id  INTEGER NOT NULL,   -- TMDB, ou MAL se media_type='anime'
          title        TEXT,
          title_en     TEXT,
          title_romaji TEXT,
          poster       TEXT,
          genres       TEXT,               -- JSON array de strings
          watched      INTEGER NOT NULL DEFAULT 0,
          watchlist    INTEGER NOT NULL DEFAULT 0,
          score        INTEGER,            -- nota pessoal 0-100
          rating       REAL,               -- media da comunidade (TMDB/MAL)
          updated_at   TEXT    NOT NULL,
          PRIMARY KEY (user_id, media_type, external_id)
        );
        CREATE INDEX idx_library_user ON library(user_id, updated_at DESC);

        CREATE TABLE progress (
          user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          media_type  TEXT    NOT NULL,
          external_id INTEGER NOT NULL,
          title       TEXT,
          poster      TEXT,
          season      INTEGER,
          episode     INTEGER,
          position    INTEGER,             -- segundos a meio (retomar)
          duration    INTEGER,
          provider    TEXT,
          started_at  TEXT,
          finished_at TEXT,
          status      TEXT    NOT NULL DEFAULT 'watching',
          updated_at  TEXT    NOT NULL,
          PRIMARY KEY (user_id, media_type, external_id)
        );
        CREATE INDEX idx_progress_user ON progress(user_id, updated_at DESC);

        CREATE TABLE lists (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name       TEXT    NOT NULL,
          created_at TEXT    NOT NULL
        );
        CREATE INDEX idx_lists_user ON lists(user_id);

        CREATE TABLE list_items (
          list_id     INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
          media_type  TEXT    NOT NULL,
          external_id INTEGER NOT NULL,
          title       TEXT,
          poster      TEXT,
          added_at    TEXT,
          PRIMARY KEY (list_id, media_type, external_id)
        );
      `);
    },
  },

  {
    version: 2,
    name: "social-seguir",
    up(db) {
      db.exec(`
        -- Quem segue quem. Uma linha por ligacao (nao duplica: PRIMARY KEY
        -- composta). O CHECK impede seguir-se a si proprio.
        CREATE TABLE follows (
          follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at  TEXT    NOT NULL,
          PRIMARY KEY (follower_id, followee_id),
          CHECK (follower_id <> followee_id)
        );
        -- Consultas mais usadas: "quem sigo" (por follower) e "quem me segue"
        -- (por followee).
        CREATE INDEX idx_follows_followee ON follows(followee_id);

        -- Perfis publicos/privados e bio. NULL/0 = privado: so o proprio ve a
        -- biblioteca. Ver store.js (canViewProfile).
        ALTER TABLE users ADD COLUMN bio TEXT;
        ALTER TABLE users ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1;
      `);
    },
  },

  {
    version: 3,
    name: "comentarios",
    up(db) {
      db.exec(`
        -- Comentarios por episodio. A chave e' (media_type, external_id, season,
        -- episode). Para filmes e para comentarios do titulo inteiro,
        -- season/episode ficam NULL.
        --
        -- A coluna parent_id permite respostas a outros comentarios (uma so
        -- nivel de aninhamento: a resposta a uma resposta fica pendurada no
        -- comentario da raiz, para a UI nao ter de lidar com arvores fundas).
        CREATE TABLE comments (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          media_type  TEXT    NOT NULL,
          external_id INTEGER NOT NULL,
          season      INTEGER,
          episode     INTEGER,
          parent_id   INTEGER REFERENCES comments(id) ON DELETE CASCADE,
          body        TEXT    NOT NULL,
          at_seconds  INTEGER,          -- timestamp no video (opcional)
          created_at  TEXT    NOT NULL,
          updated_at  TEXT,
          deleted_at  TEXT              -- apagado logicamente (conta preservada)
        );

        -- Indice da tela principal: comentarios de um episodio, mais antigos
        -- primeiro.
        CREATE INDEX idx_comments_episode
          ON comments(media_type, external_id, season, episode, created_at);
        CREATE INDEX idx_comments_parent ON comments(parent_id);

        CREATE TABLE comment_likes (
          comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TEXT    NOT NULL,
          PRIMARY KEY (comment_id, user_id)
        );
      `);
    },
  },

  {
    version: 4,
    name: "estados-da-biblioteca",
    up(db) {
      // "Em pausa" e "abandonado". A biblioteca so tinha `watched` e `watchlist`,
      // que dao tres estados (visto / para ver / sem nada). Faltavam os dois
      // estados que o MyAnimeList e o AniList tm e que as pessoas usam para
      // dizer "comecei mas parei" e "nao vou acabar" — sem eles, os estatisticos
      // do perfil contavam tudo o que estava na watchlist como "para ver", que
      // e' a intencao e nao o presente.
      //
      // Porquê uma coluna `status` e nao mais duas flags (`paused`, `dropped`):
      // os estados sao mutuamente exclusivos. Com flags teriamos de adivinhar o
      // vencedor em cada leitura e podia aparecer "visto E abandonado ao mesmo
      // tempo". Uma coluna com um valor so nao tem como ficar contraditoria.
      //
      // NULL = usa as flags (comportamento de sempre). 'paused' / 'dropped' =
      // sobrepoem-se a elas. Ver `estadoDe()` em server/src/store.js, que e' a
      // unica funcao que decide o estado final.
      db.exec(`
        ALTER TABLE library ADD COLUMN status TEXT;
        CREATE INDEX IF NOT EXISTS idx_library_status ON library(user_id, status);
      `);
    },
  },

  {
    version: 5,
    name: "notificacoes",
    up(db) {
      // Uma notificacao por evento que aconteceu a alguem.
      //
      // O indice unico (user_id, kind, ref_id, actor_id) e' o que impede o
      // silencio: se a mesma pessoa curtir o mesmo comentario cinco vezes, so'
      // ha uma notificacao. Sem esta restricao, Bastava carregar no like varias
      // vezes para encher o sino de ruido.
      //
      // `lida` e' uma coluna e nao um registo separado de leitura: nao interessa
      // QUANDO se leu, so' que ja se leu.
      //
      // `preview` e' um bocado do texto do comentario, para se ler a notificacao
      // sem abrir a pagina. Cortado pelo store, nao pela base de dados.
      db.exec(`
        CREATE TABLE notifications (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind        TEXT    NOT NULL,   -- reply | like | follow | mention
          actor_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
          ref_id      INTEGER,            -- comentario (reply/like) ou pessoa (follow)
          media_type  TEXT,               -- contexto: onde ir quando se clica
          external_id INTEGER,
          season      INTEGER,
          episode     INTEGER,
          preview     TEXT,               -- um bocado do texto, para se ler sem abrir
          read        INTEGER NOT NULL DEFAULT 0,  -- o sino so conta as que estao a 0
          created_at  TEXT    NOT NULL
        );

        CREATE INDEX idx_notifications_user
          ON notifications(user_id, created_at DESC);
        CREATE UNIQUE INDEX idx_notifications_unica
          ON notifications(user_id, kind, ref_id, COALESCE(actor_id, 0));
      `);
    },
  },
];