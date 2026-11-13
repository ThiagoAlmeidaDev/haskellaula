/* Schema completo do Recall, aplicado pelo Postgres só no primeiro boot do volume. */

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL CHECK (btrim(nome) <> ''),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  senha_hash TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O token fica só no cookie do navegador; o banco guarda o SHA-256 dele.
CREATE TABLE sessoes (
  token_hash TEXT PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em TIMESTAMPTZ NOT NULL
);

CREATE TABLE baralhos (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (btrim(nome) <> ''),
  descricao TEXT NOT NULL DEFAULT '',
  cor TEXT NOT NULL DEFAULT 'cobalto'
    CHECK (cor IN ('cobalto', 'tomate', 'sol', 'hortela', 'chiclete', 'ceu', 'terra', 'grafite')),
  padrao TEXT NOT NULL DEFAULT 'liso' CHECK (padrao IN ('liso', 'bolinhas', 'listras', 'xadrez')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cartoes (
  id SERIAL PRIMARY KEY,
  baralho_id INT NOT NULL REFERENCES baralhos(id) ON DELETE CASCADE,
  frente TEXT NOT NULL CHECK (btrim(frente) <> ''),
  verso  TEXT NOT NULL CHECK (btrim(verso)  <> ''),
  facilidade DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  intervalo INT NOT NULL DEFAULT 0,
  repeticoes INT NOT NULL DEFAULT 0,
  proxima_revisao DATE NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE revisoes (
  id SERIAL PRIMARY KEY,
  cartao_id INT NOT NULL REFERENCES cartoes(id) ON DELETE CASCADE,
  nota INT NOT NULL CHECK (nota BETWEEN 0 AND 5),
  revisado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE preferencias (
  usuario_id INT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  tamanho_pergunta INT NOT NULL CHECK (tamanho_pergunta BETWEEN 1 AND 8),
  tamanho_resposta INT NOT NULL CHECK (tamanho_resposta BETWEEN 1 AND 8),
  mostrar_pergunta BOOLEAN NOT NULL,
  revelar TEXT NOT NULL CHECK (revelar IN ('virar', 'abaixo')),
  fonte TEXT NOT NULL CHECK (fonte IN ('sem-serifa', 'serifa', 'manuscrita')),
  tema TEXT NOT NULL CHECK (tema IN ('claro', 'escuro', 'sistema')),
  embaralhar BOOLEAN NOT NULL
);

CREATE INDEX ON baralhos (usuario_id);
CREATE INDEX ON cartoes (baralho_id, proxima_revisao);
CREATE INDEX ON sessoes (usuario_id);
