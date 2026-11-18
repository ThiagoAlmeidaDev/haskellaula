# Recall

Site de flashcards com repetição espaçada, desenvolvido como trabalho da disciplina de Haskell.

A proposta é a mesma de aplicativos como o Anki. Cada pessoa cria a sua conta, monta baralhos de
cartões com pergunta e resposta e estuda um pouco por dia. Depois de ver a resposta, ela indica o
quanto lembrou (Errei, Difícil, Bom ou Fácil), e o algoritmo SM-2 usa essa nota para decidir
quando o cartão aparece de novo. Um cartão errado volta no dia seguinte, enquanto os que já estão
bem fixados aparecem com intervalos cada vez maiores.

O backend é escrito em Haskell, com [Servant](https://docs.servant.dev/) e PostgreSQL. O mesmo
executável também entrega o frontend, feito em HTML, CSS e JavaScript sem framework e sem etapa
de build.

## Telas

| Tela                                            | Acesso    | O que faz                                                                                        |
| ----------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `#/`                                            | visitante | Página de apresentação, com um maço de cartas em 3D e demonstrações animadas do método.          |
| `#/entrar`, `#/criar-conta`                     | visitante | Login e cadastro.                                                                                |
| `#/`                                            | conta     | Painel com os cartões que vencem hoje, a sequência de dias de estudo e a agenda dos próximos 14 dias. |
| `#/baralhos`                                    | conta     | Lista de baralhos, com busca, ordenação e capa personalizada (cor e estampa).                    |
| `#/baralho/:id`                                 | conta     | Cartões do baralho, com filtro por etapa (novo, aprendendo, dominado), importação de CSV/TXT e exportação. |
| `#/estudar`, `#/estudar/todos`, `#/estudar/:id` | conta     | Sessão de estudo de um baralho ou de todos. No final, os cartões errados podem ser revistos sem valer nota. |
| `#/estatisticas/:id`                            | conta     | Taxa de acerto, previsão da semana, revisões do último mês e os cartões com a facilidade mais baixa. |
| `#/preferencias`                                | conta     | Fonte e tamanho do texto, tema claro ou escuro e o jeito de mostrar a resposta.                  |

Na sessão de estudo dá para usar só o teclado: `Espaço` mostra a resposta, as teclas `1` a `4`
respondem, `S` pula o cartão e `E` abre a edição. Com a conta aberta, `Ctrl+K` (`⌘K` no Mac)
abre uma paleta de comandos para navegar entre as telas.

## Como o código está organizado

O backend fica em `app/` e é dividido em três camadas, e as dependências sempre vão das bordas
para o centro:

```txt
Main ──► Web ──► Banco ──► Nucleo
```

- **`Nucleo/`** reúne as regras do sistema: o SM-2, a validação do que chega do usuário, a
  conversão de e para JSON e o cálculo das estatísticas. Tudo ali é puro, sem acesso a banco,
  relógio ou rede. Até a data de "hoje" chega como argumento, o que permite testar essas regras
  com qualquer data e sem precisar de um banco rodando.
- **`Banco/`** guarda as consultas SQL, escritas com `postgresql-simple`. As conexões vêm de um
  pool (`resource-pool`), para não abrir uma conexão nova a cada requisição.
- **`Web/`** é a parte HTTP. Em `Web/Api.hs` a API inteira é descrita como um tipo do Servant, e
  o compilador confere se os handlers implementam exatamente aquelas rotas. Os handlers de
  baralhos e cartões seguem sempre a mesma ordem: conferem a sessão, validam o corpo da requisição, buscam o que precisa
  existir, aplicam a regra do `Nucleo` e gravam o resultado.

Para quem for ler o código pela primeira vez, uma boa ordem é começar por `Nucleo/SM2.hs`, que é
curto e concentra a ideia do projeto, seguir para `Web/Api.hs` para ver todas as rotas e, por
fim, abrir `Web/Baralhos.hs`, onde as três camadas aparecem juntas.

O frontend fica em `frontend/`. A aplicação é uma página única com roteamento por hash
(`app.js`), e cada tela tem o seu módulo em `js/views/`. A página de apresentação usa GSAP, Lenis
e three.js, que já estão prontos em `frontend/vendor/`, então o projeto não tem `npm install` nem
bundler.

```txt
app/
  Main.hs        lê o DATABASE_URL, abre o pool e sobe o servidor na porta 8080
  Nucleo/        regras puras: SM2, Types, Stats, Conta, Preferencias
  Banco/         consultas ao PostgreSQL
  Web/           rotas, sessão e entrega dos arquivos estáticos
test/Spec.hs     testes do Nucleo (hspec + QuickCheck)
scripts/smoke.sh testes da API de ponta a ponta, com curl
db/schema.sql    tabelas do banco
frontend/        HTML, CSS e JavaScript do site
.devcontainer/   ambiente para o GitHub Codespaces
```

## O algoritmo SM-2

O SM-2 foi criado por Piotr Wozniak em 1987 para o SuperMemo e é a base do agendamento de vários
programas de flashcards. Cada cartão guarda três números: a **facilidade** (começa em 2,5), o
**intervalo** em dias até a próxima revisão e quantas **repetições** seguidas a pessoa acertou.

A cada resposta, a nota `q` vai de 0 a 5. Os botões Errei, Difícil, Bom e Fácil enviam 1, 3, 4 e
5. Com ela, a facilidade é recalculada por esta fórmula, sem nunca ficar abaixo de 1,3:

```txt
EF' = EF + (0,1 − (5 − q) × (0,08 + (5 − q) × 0,02))
```

Uma nota menor que 3 conta como erro: as repetições voltam a zero e o cartão reaparece no dia
seguinte. Nos acertos, o primeiro intervalo é de 1 dia, o segundo de 6 dias e, a partir daí, o
intervalo anterior é multiplicado pela nova facilidade. Por exemplo, um cartão novo respondido
com 4, 4 e 5 volta depois de 1, 6 e 16 dias.

Nesta implementação, o intervalo é contado a partir do dia da resposta, e não da data em que o
cartão estava agendado. Assim, quem fica alguns dias sem estudar não é penalizado pelo atraso. A
implementação completa está em [app/Nucleo/SM2.hs](app/Nucleo/SM2.hs).

## Contas e sessões

A senha precisa ter pelo menos 8 caracteres, com letra maiúscula, minúscula, número e símbolo.
No banco ela fica guardada apenas como hash bcrypt.

Depois do login, o navegador recebe um token aleatório num cookie `HttpOnly`, válido por 30 dias.
O banco não guarda o token em si, só um hash SHA-256 dele. Assim, alguém com acesso ao banco não
consegue usar os dados de lá para entrar na conta de outra pessoa.

Todo baralho pertence a uma conta. Pedir um baralho ou cartão de outra pessoa devolve 404, a
mesma resposta de um id que não existe, para que a API não revele quais ids estão em uso.

## Conceitos de Haskell usados

A tabela abaixo aponta onde cada conceito visto na disciplina aparece no projeto.

| Conceito                      | Onde aparece                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `newtype` e smart constructor | `Nota`, em `Nucleo/SM2.hs`. O construtor não é exportado, e `mkNota` só aceita valores de 0 a 5.    |
| Guards e `where`              | `responder`, em `Nucleo/SM2.hs`, e `validarSenha`, em `Nucleo/Conta.hs`.                           |
| `Maybe` e `Either`            | A validação em `Nucleo/` devolve `Either Text`. As buscas em `Banco/` devolvem `Maybe`, e `Nothing` vira 404. |
| `Applicative`                 | `validarNovaConta` combina a validação de nome, e-mail e senha com `<$>` e `<*>`.                  |
| Typeclasses e instâncias      | Instâncias de `ToJSON` e `FromJSON` escritas à mão em `Nucleo/`.                                   |
| `Semigroup` e `Monoid`        | `Placar`, em `Nucleo/Stats.hs`, soma revisões e acertos numa única passada com `foldMap`.           |
| `Data.Set` e listas infinitas | `calcularResumo` conta a sequência de dias com `takeWhile` sobre a lista `[hoje, ontem, ...]`.      |
| Programação no nível de tipos | `Web/Api.hs` descreve a API como um tipo, e o compilador confere os handlers contra ele.            |
| Código puro e IO separados    | `Nucleo/` é puro; o IO fica em `Banco/` e `Web/`.                                                  |

## API

Todas as rotas ficam sob `/api` e trocam JSON. Os erros seguem o formato `{"erro": "mensagem"}`,
com o status 400 para dado inválido, 401 sem sessão ou com login errado, 404 para o que não
existe (ou é de outra conta) e 409 para conflito.

| Método   | Rota                             | Descrição                                                         |
| -------- | -------------------------------- | ----------------------------------------------------------------- |
| `GET`    | `/api/saude`                     | Confere se o banco está respondendo                               |
| `POST`   | `/api/contas`                    | Cria a conta e já abre a sessão                                   |
| `POST`   | `/api/sessao`                    | Login                                                             |
| `GET`    | `/api/sessao`                    | Usuário logado, ou `null`                                         |
| `DELETE` | `/api/sessao`                    | Logout                                                            |
| `GET`    | `/api/resumo`                    | Revisões de hoje, sequência de dias, atividade e próximos 14 dias |
| `GET`    | `/api/preferencias`              | Preferências de estudo                                            |
| `PUT`    | `/api/preferencias`              | Salva as preferências                                             |
| `GET`    | `/api/baralhos`                  | Baralhos da conta, com o total de cartões e quantos vencem hoje   |
| `POST`   | `/api/baralhos`                  | Cria um baralho (`nome`, `descricao`, `cor`, `padrao`)            |
| `GET`    | `/api/baralhos/:id`              | Um baralho                                                        |
| `PUT`    | `/api/baralhos/:id`              | Edita o baralho                                                   |
| `DELETE` | `/api/baralhos/:id`              | Exclui o baralho, junto com os cartões e o histórico de revisões  |
| `GET`    | `/api/baralhos/:id/cartoes`      | Cartões do baralho                                                |
| `POST`   | `/api/baralhos/:id/cartoes`      | Cria um cartão (`frente`, `verso`)                                |
| `PUT`    | `/api/cartoes/:id`               | Edita o texto do cartão, sem alterar o agendamento                |
| `DELETE` | `/api/cartoes/:id`               | Exclui o cartão                                                   |
| `GET`    | `/api/baralhos/:id/revisar`      | Cartões do baralho que vencem hoje, com a previsão de cada nota   |
| `GET`    | `/api/revisar`                   | O mesmo, considerando todos os baralhos da conta                  |
| `POST`   | `/api/cartoes/:id/responder`     | Registra a resposta (`{"nota": 0..5}`) e devolve o novo estado    |
| `GET`    | `/api/baralhos/:id/estatisticas` | Estatísticas do baralho                                           |

As cinco primeiras rotas funcionam sem login; as demais exigem o cookie de sessão. Um exemplo de
uso com `curl`:

```sh
curl -c sessao.txt -X POST localhost:8080/api/contas -H 'Content-Type: application/json' -d '{"nome":"Ana","email":"ana@exemplo.com","senha":"Segredo#123"}'
curl -b sessao.txt -X POST localhost:8080/api/baralhos -H 'Content-Type: application/json' -d '{"nome":"Capitais"}'
curl -b sessao.txt -X POST localhost:8080/api/baralhos/1/cartoes -H 'Content-Type: application/json' -d '{"frente":"França","verso":"Paris"}'
curl -b sessao.txt -X POST localhost:8080/api/cartoes/1/responder -H 'Content-Type: application/json' -d '{"nota":4}'
```

## Como rodar

São necessários o [ghcup](https://www.haskell.org/ghcup/) com GHC 9.10 e cabal 3.16, e o Docker
para subir o PostgreSQL. Com isso instalado, na raiz do repositório:

```sh
docker compose up -d
cabal update
cabal build
cabal run haskellaula
```

O site fica em <http://localhost:8080>. O `cabal run` precisa ser executado na raiz do
repositório, porque o servidor procura os arquivos do site na pasta `frontend/`.

Na primeira vez que o banco sobe, o Docker cria as tabelas a partir de `db/schema.sql`. Esse
script só roda com o volume vazio, então para recriar o banco do zero é preciso apagar o volume
com `docker compose down -v`, o que também apaga todos os dados.

Por padrão, o servidor se conecta ao banco do `docker-compose.yml`. Para usar outro banco, defina
a variável `DATABASE_URL`, no formato
`host=localhost port=5432 dbname=flashcards user=flashcards password=flashcards`.

### Windows

O pacote `postgresql-libpq` precisa da `libpq` para compilar. No Windows, ela pode ser instalada
pelo MSYS2 que acompanha o ghcup:

```sh
ghcup run --mingw-path -- pacman -S --noconfirm mingw-w64-x86_64-postgresql
```

Antes de compilar ou rodar no Git Bash, coloque essa pasta no `PATH`:

```sh
export PATH="/c/ghcup/msys64/mingw64/bin:$PATH"
```

O Windows também trava o `haskellaula.exe` enquanto ele está rodando, então é preciso parar o
servidor (`Ctrl+C`) antes de compilar de novo.

<details>
<summary><strong>Rodando no GitHub Codespaces</strong></summary>

<br>

O repositório tem uma configuração de devcontainer em `.devcontainer/`, com o GHC, as
bibliotecas de sistema e um PostgreSQL já com as tabelas criadas.

1. No GitHub, abra **Code → Codespaces → Create codespace on main**.
2. Na primeira criação, o Codespace compila todas as dependências do projeto, o que leva alguns
   minutos.
3. O servidor sobe sozinho sempre que o Codespace é ligado. A saída fica em `/tmp/recall.log`.
4. Na aba **Ports**, abra a porta **8080**. Ela começa privada; para outra pessoa acessar, clique
   com o botão direito e escolha **Port Visibility → Public**.

O Codespace desliga depois de 30 minutos sem uso, e o site sai do ar junto. Visitas ao site não
contam como uso, só o terminal e o editor. Esse limite pode ser aumentado em
**GitHub → Settings → Codespaces → Default idle timeout**. Se ele desligar, basta abrir de novo: o
servidor volta sozinho e a compilação não precisa ser refeita, a menos que o container seja
reconstruído (**Rebuild Container**).

</details>

## Testes

```sh
cabal test
bash scripts/smoke.sh
```

O `cabal test` roda os testes de [test/Spec.hs](test/Spec.hs), escritos com hspec e QuickCheck.
Eles cobrem o SM-2, as validações, o JSON e as estatísticas. Como o `Nucleo` é puro, não precisam
de banco nem do servidor rodando. Além dos exemplos fixos, há testes de propriedade que geram
sequências aleatórias de notas e conferem que a facilidade nunca fica abaixo de 1,3 e que a
próxima revisão é sempre depois de hoje.

O `scripts/smoke.sh` testa a API de verdade com `curl` e precisa do servidor rodando. Ele passa
por cadastro, login, logout, isolamento entre contas, criação e exclusão de baralhos e cartões e
pelos códigos de erro. O script cria as próprias contas de teste e as apaga no final. Para não
misturar com os seus dados, dá para rodar contra um banco separado:

```sh
docker compose exec -T db psql -U flashcards -c "CREATE DATABASE flashcards_teste"
docker compose exec -T db psql -U flashcards -d flashcards_teste < db/schema.sql
DATABASE_URL="host=localhost port=5432 dbname=flashcards_teste user=flashcards password=flashcards" cabal run haskellaula
BANCO=flashcards_teste bash scripts/smoke.sh
```

## Licença

BSD-3-Clause. Veja o arquivo [LICENSE](LICENSE).
