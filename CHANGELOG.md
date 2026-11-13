# Revision history for haskellaula

## 0.1.0.0 -- 2026-11-13

* Recall: flashcards com repetição espaçada pelo algoritmo SM-2.
* API REST com Servant e warp, banco PostgreSQL 16 (Docker Compose) acessado com
  `postgresql-simple` e pool de conexões.
* Contas com cadastro, login e sair: senha em bcrypt e sessão em cookie `HttpOnly`, com o token
  guardado no banco só como SHA-256. Cada baralho tem dono, e recurso de outra conta responde 404.
* Baralhos com capa (cor e estampa), cartões, revisão diária, estatísticas por baralho e resumo
  da conta (revisões de hoje, sequência de dias e próximos 14 dias).
* Preferências de estudo por conta: tamanho do texto, fonte, tema, virar ou mostrar embaixo,
  pergunta visível e embaralhar.
* Frontend em HTML, CSS e JavaScript puro, servido pelo mesmo executável: landing animada,
  painel, baralhos, sessão de estudo com atalhos de teclado, estatísticas e paleta de comandos.
* Testes de unidade e de propriedade do núcleo puro (hspec + QuickCheck) e smoke HTTP da API.
