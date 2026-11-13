# Recall: flashcards com repetição espaçada

Trabalho realizado para a matéria de **Haskell**. O Recall é um site para estudar com flashcards:
cada pessoa cria a sua conta, monta baralhos de cartões (pergunta e resposta) e estuda um pouco
por dia. Cada resposta recebe uma nota, e o algoritmo **SM-2** decide quando aquele cartão volta:
o que você erra volta amanhã, o que você domina demora cada vez mais para voltar.

O backend é todo em Haskell (Servant, warp e PostgreSQL), e o mesmo executável serve o frontend
em HTML, CSS e JavaScript puro.

## 1. Visão geral

```txt
 Navegador ──► warp (porta 8080) ──► Servant ──┬──► /api/*  handlers (Web/) ──► Banco/ ──► PostgreSQL 16
                                               │              │                            (Docker Compose)
                                               │              └──► Nucleo/  (regras puras: SM-2, validação,
                                               │                             estatísticas)
                                               └──► /*      arquivos de frontend/ (sem build)
```

- **Backend (`app/`):** Haskell com [Servant](https://docs.servant.dev/) e warp. A API inteira é
  um tipo Servant (`Web/Api.hs`), e o compilador confere se os handlers batem com ela.
- **Núcleo puro (`app/Nucleo/`):** SM-2, validação de entrada, JSON e estatísticas. Não faz IO,
  não lê o relógio nem o banco: "hoje" chega como argumento. É o que o test-suite compila.
- **Banco:** PostgreSQL 16 via Docker Compose, acessado com `postgresql-simple` e um pool de
  conexões (`resource-pool`). O schema está em `db/schema.sql`.
- **Frontend (`frontend/`):** HTML, CSS e JavaScript puro, servido pelo próprio executável em `/`.
  A landing usa GSAP, Lenis e three.js, que ficam versionados em `frontend/vendor/`.

## 2. Contas e sessões

- Cadastro com nome, e-mail e senha. A senha precisa de 8 caracteres a 72 bytes, com letra
  maiúscula, minúscula, número e símbolo, e vai para o banco só como hash **bcrypt** (custo 12).
- O e-mail é guardado sem espaços nas pontas e em minúsculas: `Ana@X.com` e `ana@x.com` são a
  mesma conta.
- A sessão é um token aleatório de 32 bytes no cookie `recall_sessao` (`HttpOnly`,
  `SameSite=Strict`, 30 dias). O banco guarda só o **SHA-256** do token: quem lê o banco não
  consegue se passar pela pessoa.
- Cada baralho tem dono. Baralho ou cartão de outra conta responde **404**, igual a um id que não
  existe.
- Login errado tem a mesma mensagem para e-mail desconhecido e senha errada.

## 3. Telas

| Tela                     | Quem vê   | O que faz                                                                                     |
| ------------------------ | --------- | --------------------------------------------------------------------------------------------- |
| `#/`                     | visitante | Apresentação animada: maço de cartas em 3D, curva do esquecimento, sessão demonstrada, calendário de revisões e a carta "do seu jeito". |
| `#/entrar`, `#/criar-conta` | visitante | Login e cadastro, com a regra da senha marcada enquanto se digita.                        |
| `#/`                     | conta     | Painel: cartões que esperam hoje, "Estudar tudo", sequência de dias e os próximos 14 dias.   |
| `#/baralhos`             | conta     | Baralhos com busca, ordenação, capa (cor e estampa), criar, editar e excluir.                 |
| `#/baralho/:id`          | conta     | Cartões do baralho com filtros por etapa (novo, aprendendo, dominado), busca, adicionar um a um, colar uma lista, importar CSV/TXT e exportar. |
| `#/estudar`, `#/estudar/todos`, `#/estudar/:id` | conta | Sessão de estudo: `Espaço` mostra a resposta, `1` a `4` respondem (Errei, Difícil, Bom, Fácil), `S` pula, `E` edita. No fim, os errados podem ser revistos em treino. |
| `#/estatisticas/:id`     | conta     | Taxa de acerto, previsão de 7 dias, revisões dos últimos 30 dias e cartões difíceis.          |
| `#/preferencias`         | conta     | Tamanho e fonte do texto, virar a carta ou mostrar embaixo, pergunta visível, embaralhar e tema claro/escuro, com prévia ao vivo. |

`Ctrl+K` (ou `⌘K`) abre a paleta de comandos. Todo texto vindo do usuário entra na página como
texto (`textContent`), nunca como HTML.

## 4. Como funciona o SM-2

A cada resposta o cartão recalcula o próprio estado em
[app/Nucleo/SM2.hs](app/Nucleo/SM2.hs), a partir de uma **nota** de 0 a 5 (os botões Errei,
Difícil, Bom e Fácil mandam 1, 3, 4 e 5):

| Campo            | Começa em | Regra                                                                            |
| ---------------- | --------- | -------------------------------------------------------------------------------- |
| `facilidade`     | 2,5       | `EF' = EF + (0,1 − (5−q)·(0,08 + (5−q)·0,02))`, nunca abaixo de 1,3               |
| `repeticoes`     | 0         | Nota menor que 3 zera; nota 3 ou mais soma 1                                     |
| `intervalo`      | 0         | Nota menor que 3: 1 dia. Senão, 1 dia na 1ª, 6 dias na 2ª e `intervalo × EF'` depois |
| `proximaRevisao` | hoje      | hoje + intervalo                                                                 |

Exemplo: um cartão novo respondido com notas 4, 4 e 5 volta em 1, 6 e 16 dias. "Hoje" é sempre o
dia local do servidor.

## 5. Conceitos de Haskell usados

| Conceito                      | Onde                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `newtype` + smart constructor | `Nota` em `Nucleo/SM2.hs`: o construtor não é exportado, e `mkNota` só devolve `Just` para 0 a 5 |
| Guards e `where`              | `responder` em `Nucleo/SM2.hs`, `validarSenha` em `Nucleo/Conta.hs`                           |
| `Maybe` e `Either`            | Validação em `Nucleo/` (`Either Text`) e busca por id em `Banco/` (`Maybe` vira 404)          |
| `Applicative`                 | `validarNovaConta` junta nome, e-mail e senha com `<$>` e `<*>`, parando no primeiro erro     |
| Typeclasses e instâncias      | `ToJSON`/`FromJSON` escritas à mão em `Nucleo/`                                               |
| Semigroup e Monoid            | `Placar` em `Nucleo/Stats.hs`: soma revisões e acertos numa passada só, com `foldMap`         |
| `Data.Set` e listas infinitas | `calcularResumo`: a sequência de dias é um `takeWhile` sobre `[hoje, ontem, ...]`             |
| Programação no nível de tipos | `Web/Api.hs`: a API é um tipo, e o compilador confere os handlers contra ela                  |
| Núcleo puro e IO nas bordas   | `Nucleo/` é puro; `Banco/` e `Web/` fazem IO                                                  |

## 6. API

Todas as rotas ficam em `/api`. Os erros têm sempre o formato `{"erro": "mensagem"}`: **400**
para dado inválido, **401** sem sessão ou com login errado, **404** para id que não existe (ou que
é de outra conta) e **409** para conflito.

| Método   | Rota                             | O que faz                                                         |
| -------- | -------------------------------- | ----------------------------------------------------------------- |
| `GET`    | `/api/saude`                     | `{"banco":"ok"}` quando o banco responde                          |
| `POST`   | `/api/contas`                    | cria a conta e já abre a sessão; 409 se o e-mail já existe        |
| `POST`   | `/api/sessao`                    | login                                                             |
| `GET`    | `/api/sessao`                    | usuário logado, ou `null`                                         |
| `DELETE` | `/api/sessao`                    | sair                                                              |
| `GET`    | `/api/resumo`                    | revisões de hoje, sequência de dias, atividade e próximos 14 dias |
| `GET`    | `/api/preferencias`              | preferências de estudo (o padrão para quem nunca salvou)          |
| `PUT`    | `/api/preferencias`              | salva as preferências                                             |
| `GET`    | `/api/baralhos`                  | baralhos da conta, com total de cartões e quantos vencem hoje     |
| `POST`   | `/api/baralhos`                  | cria baralho (`nome`, `descricao`, `cor`, `padrao`)               |
| `GET`    | `/api/baralhos/:id`              | um baralho                                                        |
| `PUT`    | `/api/baralhos/:id`              | edita o baralho                                                   |
| `DELETE` | `/api/baralhos/:id`              | exclui o baralho, com os cartões e as revisões dele               |
| `GET`    | `/api/baralhos/:id/cartoes`      | cartões do baralho                                                |
| `POST`   | `/api/baralhos/:id/cartoes`      | cria cartão (`frente`, `verso`)                                   |
| `PUT`    | `/api/cartoes/:id`               | edita o cartão (o estado do SM-2 não muda)                        |
| `DELETE` | `/api/cartoes/:id`               | exclui o cartão                                                   |
| `GET`    | `/api/baralhos/:id/revisar`      | cartões vencidos do baralho, cada um com a previsão de cada nota  |
| `GET`    | `/api/revisar`                   | o mesmo, de todos os baralhos da conta                            |
| `POST`   | `/api/cartoes/:id/responder`     | aplica a nota (`{nota}`, 0 a 5) e devolve o novo estado           |
| `GET`    | `/api/baralhos/:id/estatisticas` | números do baralho, previsão, revisões por dia e cartões difíceis |

Fora as cinco primeiras, todas exigem o cookie de sessão (sem ele, 401). Exemplo com `curl`:

```sh
curl -c sessao.txt -X POST localhost:8080/api/contas -H 'Content-Type: application/json' -d '{"nome":"Ana","email":"ana@exemplo.com","senha":"Segredo#123"}'
curl -b sessao.txt -X POST localhost:8080/api/baralhos -H 'Content-Type: application/json' -d '{"nome":"Capitais"}'
curl -b sessao.txt -X POST localhost:8080/api/baralhos/1/cartoes -H 'Content-Type: application/json' -d '{"frente":"França","verso":"Paris"}'
curl -b sessao.txt -X POST localhost:8080/api/cartoes/1/responder -H 'Content-Type: application/json' -d '{"nota":4}'
```

## 7. Rodar e testar

### Pré-requisitos

- [ghcup](https://www.haskell.org/ghcup/) com GHC 9.10 e cabal 3.16
- Docker Desktop (aberto, com o engine rodando)
- No Windows, a `libpq` do MSYS2 que vem com o ghcup. O pacote `postgresql-libpq` precisa dela
  para compilar, e o executável precisa da `libpq.dll` para rodar. Instale uma vez:

  ```sh
  ghcup run --mingw-path -- pacman -S --noconfirm mingw-w64-x86_64-postgresql
  ```

### Passo a passo (Git Bash, na raiz do repositório)

```sh
docker compose up -d                               # PostgreSQL; aplica db/schema.sql no primeiro boot
export PATH="/c/ghcup/msys64/mingw64/bin:$PATH"    # só no Windows: pkg-config, pg_config e libpq.dll
cabal update
cabal build
cabal run haskellaula                              # serve em http://localhost:8080
```

Abra `http://localhost:8080` e crie a sua conta. O servidor procura o frontend em `frontend/`,
então rode o `cabal run` na raiz do repositório.

| Variável       | Padrão                                                                           |
| -------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL` | `host=localhost port=5432 dbname=flashcards user=flashcards password=flashcards` |

A porta é fixa em 8080. As credenciais valem só para desenvolvimento e são as mesmas do
[docker-compose.yml](docker-compose.yml).

> [!NOTE]
> O Windows trava o `haskellaula.exe` enquanto ele roda. Antes de recompilar, pare o servidor
> com `Ctrl+C` ou `taskkill //IM haskellaula.exe //F`.

> [!WARNING]
> O `db/schema.sql` só roda quando o volume do banco está vazio. Recriar o banco com
> `docker compose down -v && docker compose up -d` **apaga todos os dados**.

### No GitHub Codespaces

O repositório traz um devcontainer em `.devcontainer/`: um container com GHC 9.10.3, `libpq-dev`
e `pkg-config`, ligado a um PostgreSQL 16 que já sobe com o `db/schema.sql` aplicado. As versões
das dependências ficam travadas em `cabal.project.freeze`, as mesmas que passaram nos testes.

1. No GitHub, abra o repositório e vá em **Code → Codespaces → Create codespace on main**.
2. Espere a criação terminar. Ela roda `cabal update && cabal build all` sozinha; da primeira vez
   isso compila todas as dependências e leva cerca de 6 minutos numa máquina de 4 núcleos (numa
   de 2 núcleos, o dobro).
3. No terminal, na raiz do projeto: `cabal run haskellaula`.
4. Na aba **Ports**, abra a porta **8080** no navegador. O endereço tem o formato
   `https://<nome-do-codespace>-8080.app.github.dev`. Por padrão a porta é privada (só abre para
   a sua conta do GitHub); para outra pessoa acessar, clique com o botão direito nela e escolha
   **Port Visibility → Public**.

> [!IMPORTANT]
> O Codespace desliga depois de 30 minutos sem uso, e o servidor cai junto. Para deixar pronto
> com antecedência, aumente o limite em **GitHub → Settings → Codespaces → Default idle timeout**
> (até 240 minutos). Se ele desligar, basta abrir de novo e rodar `cabal run haskellaula`: o que
> já foi compilado continua lá. Evite **Rebuild Container**, que apaga o cache de pacotes do cabal
> e obriga a compilar as dependências de novo.

### Testes

```sh
cabal test               # unidade e propriedade do núcleo puro, sem banco
bash scripts/smoke.sh    # HTTP de ponta a ponta, com o servidor rodando
```

- [test/Spec.hs](test/Spec.hs) (hspec + QuickCheck) cobre o SM-2, a validação de baralhos,
  cartões e contas, o JSON com acento e emoji, as estatísticas e o resumo. Duas propriedades
  valem para qualquer sequência de notas: a facilidade nunca fica abaixo de 1,3, e a próxima
  revisão é sempre depois de hoje.
- [scripts/smoke.sh](scripts/smoke.sh) exercita a API real com `curl`: cadastro, login, sair e
  token revogado, isolamento entre duas contas, CRUD, 400, 401, 404 e 409, exclusão em cascata,
  respostas simultâneas e acento e emoji indo e voltando do banco. Cria as próprias contas e as
  apaga no fim. `BASE` muda o endereço do servidor e `BANCO`, o banco que o script consulta.

Para testar sem mexer nos seus dados, crie um banco separado e suba o servidor apontando para ele:

```sh
docker compose exec -T db psql -U flashcards -c "CREATE DATABASE flashcards_teste"
docker compose exec -T db psql -U flashcards -d flashcards_teste < db/schema.sql
DATABASE_URL="host=localhost port=5432 dbname=flashcards_teste user=flashcards password=flashcards" cabal run haskellaula
BANCO=flashcards_teste bash scripts/smoke.sh
```

## 8. Estrutura do repositório

```txt
haskellaula.cabal        executável haskellaula (RTS -threaded) + test-suite haskellaula-test
cabal.project            projeto de um pacote só
cabal.project.freeze     versões exatas das dependências
docker-compose.yml       PostgreSQL 16 para desenvolvimento local
.devcontainer/           ambiente do GitHub Codespaces (GHC 9.10.3 + PostgreSQL 16)
db/schema.sql            tabelas usuarios, sessoes, baralhos, cartoes, revisoes e preferencias
app/
  Main.hs                lê DATABASE_URL, abre o pool, confere o banco e sobe o warp na 8080
  Nucleo/                PURO: SM2, Types (baralhos e cartões), Stats, Conta, Preferencias
  Banco/                 IO: consultas postgresql-simple (Baralhos, Contas, Preferencias)
  Web/                   IO: HTTP com Servant
    Api.hs               o tipo com todas as rotas
    Comum.hs             envelope de erro, acesso ao pool, "hoje"
    Sessao.hs            bcrypt, token, SHA-256 e cookie
    Contas.hs            cadastro, login, sessão e sair
    Baralhos.hs          rotas de baralhos, cartões, revisão, estatísticas e preferências
    Server.hs            monta a aplicação e serve os arquivos estáticos
test/Spec.hs             hspec + QuickCheck do núcleo puro
scripts/smoke.sh         testes HTTP com curl contra o servidor rodando
frontend/
  index.html, app.js     página única e roteador por hash
  styles.css             estilo das telas da conta
  landing.css            estilo da landing
  js/                    API, sessão, componentes, paleta de comandos e as telas (views/)
  js/landing/            seções e animações da landing
  vendor/                GSAP, Lenis e three.js (versões e licenças em vendor/LEIAME.md)
```

As dependências vão sempre das bordas para o núcleo: `Main → Web.Server → Web.* → Banco.* → Nucleo.*`.
Por isso o test-suite compila só `Nucleo/`, e os testes rodam sem banco.
