#!/usr/bin/env bash
# Smoke da API contra um servidor já rodando: bash scripts/smoke.sh
# Tópico: rotas HTTP de ponta a ponta (status, envelope de erro, contas, isolamento, cascata, acento e emoji).
# Motivo: provar no banco real o que o test-suite puro não alcança. BANCO é o banco do servidor (padrão flashcards).
set -e

BASE=${BASE:-http://localhost:8080}
BANCO=${BANCO:-flashcards}
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
CORPO="$TMP/corpo"
ENVIO="$TMP/envio"
JAR="$TMP/sessao-ana"
FALHAS=0
trap 'rm -rf "$TMP"' EXIT

ok()    { echo "OK    $1"; }
falha() { echo "FALHA $1"; FALHAS=$((FALHAS + 1)); }

# check <descrição> <status esperado> <curl args...>; o corpo fica em $CORPO. Usa os cookies de $JAR.
check() {
  local desc=$1 esperado=$2 status
  shift 2
  status=$(curl -s -b "$JAR" -c "$JAR" -o "$CORPO" -w '%{http_code}' "$@")
  if [ "$status" = "$esperado" ]; then ok "$desc"; else falha "$desc (esperado $esperado, veio $status: $(cat "$CORPO"))"; fi
}

# contem <descrição> <texto>: o último corpo contém o texto literal. LC_ALL=C compara bytes, porque o regex do MSYS não casa emoji.
contem() {
  if LC_ALL=C grep -qF -- "$2" "$CORPO"; then ok "$1"; else falha "$1 (corpo: $(cat "$CORPO"))"; fi
}

enviar() {
  local desc=$1 esperado=$2 metodo=$3 caminho=$4 dados=$5
  # Por arquivo, para que acentos e emoji cheguem em UTF-8 sem passar pela linha de comando do Windows.
  printf '%s' "$dados" > "$ENVIO"
  check "$desc" "$esperado" -X "$metodo" -H 'Content-Type: application/json' --data-binary "@$ENVIO" "$BASE$caminho"
}

nao_contem() {
  if LC_ALL=C grep -qF -- "$2" "$CORPO"; then falha "$1 (corpo: $(cat "$CORPO"))"; else ok "$1"; fi
}

ultimo_id() { LC_ALL=C sed -n 's/.*"id":\([0-9]*\).*/\1/p' "$CORPO" | head -n 1; }

psql_db() { docker compose -f "$RAIZ/docker-compose.yml" exec -T db psql -U flashcards -d "$BANCO" -tAc "$1"; }

SUFIXO="$(date +%s)-$RANDOM"
EMAIL_ANA="ana-$SUFIXO@smoke.teste"
EMAIL_BETO="beto-$SUFIXO@smoke.teste"

check "saúde" 200 "$BASE/api/saude"

check "sem sessão a lista de baralhos dá 401" 401 "$BASE/api/baralhos"
check "sem sessão as preferências dão 401" 401 "$BASE/api/preferencias"
contem "o 401 vem no envelope de erro" '{"erro":"faça login para continuar"}'
check "sem sessão o usuário atual é null" 200 "$BASE/api/sessao"
contem "o corpo sem sessão é null" "null"
enviar "cadastro com e-mail inválido" 400 POST /api/contas '{"nome":"Ana","email":"ana-sem-arroba","senha":"Segredo#123"}'
contem "erro do e-mail em JSON" '{"erro":"e-mail inválido"}'
enviar "cadastro com senha curta" 400 POST /api/contas "{\"nome\":\"Ana\",\"email\":\"$EMAIL_ANA\",\"senha\":\"1234567\"}"
contem "erro da senha em JSON" '{"erro":"a senha deve ter pelo menos 8 caracteres"}'
enviar "cadastro com senha sem símbolo" 400 POST /api/contas "{\"nome\":\"Ana\",\"email\":\"$EMAIL_ANA\",\"senha\":\"Segredo1234\"}"
contem "erro do símbolo em JSON" '{"erro":"a senha precisa de um símbolo"}'
enviar "cadastro com senha sem maiúscula" 400 POST /api/contas "{\"nome\":\"Ana\",\"email\":\"$EMAIL_ANA\",\"senha\":\"segredo#123\"}"
contem "erro da maiúscula em JSON" '{"erro":"a senha precisa de uma letra maiúscula"}'
enviar "cadastro com senha sem número" 400 POST /api/contas "{\"nome\":\"Ana\",\"email\":\"$EMAIL_ANA\",\"senha\":\"Segredo#abc\"}"
contem "erro do número em JSON" '{"erro":"a senha precisa de um número"}'
enviar "cadastro sem nome" 400 POST /api/contas "{\"email\":\"$EMAIL_ANA\",\"senha\":\"Segredo#123\"}"
contem "erro do nome em JSON" '{"erro":"informe seu nome"}'
check "o cadastro inválido não abriu sessão" 200 "$BASE/api/sessao"
contem "continua sem usuário" "null"

enviar "cadastro de Ana com acento no nome" 201 POST /api/contas "{\"nome\":\"Ana Conceição\",\"email\":\"  ${EMAIL_ANA^^} \",\"senha\":\"Segredo #123\"}"
contem "o e-mail volta normalizado" "\"email\":\"$EMAIL_ANA\""
contem "o nome volta com acento" '"nome":"Ana Conceição"'
nao_contem "a resposta não expõe a senha" 'senha'
if grep -q "recall_sessao" "$JAR"; then ok "o cadastro grava o cookie de sessão"; else falha "o cadastro não gravou o cookie ($(cat "$JAR"))"; fi
check "o cadastro já deixa a sessão aberta" 200 "$BASE/api/sessao"
contem "a sessão é da Ana" "\"email\":\"$EMAIL_ANA\""
TOKEN_HASH_NO_BANCO=$(psql_db "SELECT count(*) FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE u.email = '$EMAIL_ANA' AND s.token_hash ~ '^[0-9a-f]{64}$'")
if [ "$TOKEN_HASH_NO_BANCO" = "1" ]; then ok "o banco guarda o SHA-256 do token"; else falha "sessões com hash no banco: $TOKEN_HASH_NO_BANCO"; fi
if [ "$(psql_db "SELECT left(senha_hash, 7) FROM usuarios WHERE email = '$EMAIL_ANA'")" = '$2b$12$' ]; then ok "a senha está em bcrypt de custo 12"; else falha "a senha não está em bcrypt"; fi
enviar "cadastro com e-mail repetido em outra caixa" 409 POST /api/contas "{\"nome\":\"Outra\",\"email\":\"${EMAIL_ANA^^}\",\"senha\":\"Segredo#123\"}"
contem "erro de e-mail repetido em JSON" '{"erro":"já existe uma conta com este e-mail"}'

TOKEN_ANA=$(sed -n 's/.*recall_sessao\t//p' "$JAR")
check "sair" 204 -X DELETE "$BASE/api/sessao"
check "depois de sair não há sessão" 200 "$BASE/api/sessao"
contem "depois de sair o usuário é null" "null"
check "o token antigo não vale depois de sair" 401 -H "Cookie: recall_sessao=$TOKEN_ANA" "$BASE/api/baralhos"
enviar "login com senha errada" 401 POST /api/sessao "{\"email\":\"$EMAIL_ANA\",\"senha\":\"Segredo #124\"}"
contem "erro do login em JSON" '{"erro":"e-mail ou senha incorretos"}'
enviar "login com e-mail desconhecido" 401 POST /api/sessao '{"email":"ninguem@smoke.teste","senha":"Segredo#123"}'
contem "o e-mail desconhecido tem a mesma mensagem" '{"erro":"e-mail ou senha incorretos"}'
enviar "login sem senha" 400 POST /api/sessao "{\"email\":\"$EMAIL_ANA\"}"
contem "erro do login incompleto em JSON" '{"erro":"informe e-mail e senha"}'
enviar "login com e-mail em outra caixa" 200 POST /api/sessao "{\"email\":\"${EMAIL_ANA^^}\",\"senha\":\"Segredo #123\"}"
contem "o login devolve o usuário" "\"email\":\"$EMAIL_ANA\""
check "o login abre a sessão" 200 "$BASE/api/sessao"

check "preferências de quem nunca salvou" 200 "$BASE/api/preferencias"
contem "o padrão tem tamanho 3 e virar" '"revelar":"virar","tamanhoPergunta":3'
enviar "salvar preferências" 200 PUT /api/preferencias '{"tamanhoPergunta":5,"tamanhoResposta":1,"mostrarPergunta":false,"revelar":"abaixo","fonte":"manuscrita","tema":"escuro","embaralhar":true}'
contem "as preferências salvas voltam" '"fonte":"manuscrita"'
check "as preferências ficam na conta" 200 "$BASE/api/preferencias"
contem "o tema salvo continua" '"tema":"escuro"'
enviar "preferência com tamanho 9" 400 PUT /api/preferencias '{"tamanhoPergunta":9,"tamanhoResposta":1,"mostrarPergunta":false,"revelar":"abaixo","fonte":"manuscrita","tema":"escuro","embaralhar":true}'
contem "erro do tamanho em JSON" '{"erro":"o tamanho do texto deve estar entre 1 e 8"}'
enviar "preferência com tema desconhecido" 400 PUT /api/preferencias '{"tamanhoPergunta":2,"tamanhoResposta":1,"mostrarPergunta":false,"revelar":"abaixo","fonte":"manuscrita","tema":"neon","embaralhar":true}'
contem "erro do tema em JSON" '{"erro":"tema inválido"}'
check "o valor recusado não mudou nada" 200 "$BASE/api/preferencias"
contem "o tamanho salvo continua 5" '"tamanhoPergunta":5'
enviar "preferência com tamanho 8, o maior da escala" 200 PUT /api/preferencias '{"tamanhoPergunta":8,"tamanhoResposta":8,"mostrarPergunta":false,"revelar":"abaixo","fonte":"manuscrita","tema":"escuro","embaralhar":true}'
contem "o tamanho 8 volta salvo" '"tamanhoPergunta":8'

enviar "criar baralho" 201 POST /api/baralhos '{"nome":"Smoke","descricao":"teste"}'
contem "o baralho novo tem a capa padrão" '"cor":"cobalto"'
BID=$(ultimo_id)
enviar "baralho com cor fora da paleta" 400 POST /api/baralhos '{"nome":"x","cor":"roxo"}'
contem "erro da cor em JSON" '{"erro":"cor inválida"}'
check "listar baralhos" 200 "$BASE/api/baralhos"
contem "a lista inclui o baralho criado" "\"id\":$BID,"
check "buscar baralho" 200 "$BASE/api/baralhos/$BID"
contem "o baralho traz as etapas zeradas" '"etapas":{"aprendendo":0,"dominados":0,"novos":0}'
enviar "editar baralho" 200 PUT "/api/baralhos/$BID" '{"nome":"Smoke editado ✏️","descricao":"nova descrição","cor":"tomate","padrao":"listras"}'
contem "a cor editada volta no corpo" '"cor":"tomate"'
contem "o padrão editado volta no corpo" '"padrao":"listras"'
contem "o nome editado volta no corpo" '"nome":"Smoke editado ✏️"'
enviar "editar baralho com nome em branco" 400 PUT "/api/baralhos/$BID" '{"nome":"  "}'
contem "erro de nome ao editar" '{"erro":"nome é obrigatório"}'
enviar "editar baralho inexistente" 404 PUT /api/baralhos/999999 '{"nome":"x"}'
enviar "nome em branco" 400 POST /api/baralhos '{"nome":"   "}'
contem "erro de nome em JSON" '{"erro":"nome é obrigatório"}'

enviar "criar cartão com acentos e emoji" 201 POST "/api/baralhos/$BID/cartoes" '{"frente":"Ação 🧠","verso":"日本"}'
CID=$(ultimo_id)
check "listar cartões" 200 "$BASE/api/baralhos/$BID/cartoes"
contem "a frente volta igual" '"frente":"Ação 🧠"'
contem "o verso volta igual" '"verso":"日本"'
enviar "frente só com espaços" 400 POST "/api/baralhos/$BID/cartoes" '{"frente":"   ","verso":"x"}'
contem "erro de frente em JSON" '{"erro":"frente é obrigatória"}'
check "a frente em branco não inseriu nada" 200 "$BASE/api/baralhos/$BID/cartoes"
contem "continua um cartão só" "\"id\":$CID,"

enviar "editar cartão" 200 PUT "/api/cartoes/$CID" '{"frente":"Ação 🧠 editada","verso":"日本"}'
contem "a edição volta no corpo" '"frente":"Ação 🧠 editada"'
enviar "editar com verso vazio" 400 PUT "/api/cartoes/$CID" '{"frente":"x","verso":""}'
enviar "editar cartão inexistente" 404 PUT /api/cartoes/999999 '{"frente":"x","verso":"y"}'

check "baralho inexistente" 404 "$BASE/api/baralhos/999999"
contem "erro 404 em JSON" '"erro"'
check "o erro vem como application/json" 404 -D "$TMP/cabecalho" "$BASE/api/baralhos/999999"
if grep -qi "^content-type: application/json" "$TMP/cabecalho"; then ok "cabeçalho do erro"; else falha "cabeçalho do erro ($(cat "$TMP/cabecalho"))"; fi
check "cartões de baralho inexistente" 404 "$BASE/api/baralhos/999999/cartoes"
enviar "criar cartão em baralho inexistente" 404 POST /api/baralhos/999999/cartoes '{"frente":"x","verso":"y"}'
check "excluir cartão inexistente" 404 -X DELETE "$BASE/api/cartoes/999999"

enviar "criar cartão descartável" 201 POST "/api/baralhos/$BID/cartoes" '{"frente":"apagar","verso":"apagar"}'
DESCARTE=$(ultimo_id)
check "excluir cartão" 204 -X DELETE "$BASE/api/cartoes/$DESCARTE"
check "excluir de novo dá 404" 404 -X DELETE "$BASE/api/cartoes/$DESCARTE"

check "o cartão novo aparece em revisar" 200 "$BASE/api/baralhos/$BID/revisar"
contem "revisar lista o cartão" "\"id\":$CID,"
contem "o cartão a revisar traz as previsões" '"previsoes":[{"dias":1,"nota":0}'
contem "o cartão novo está na etapa novo" '"etapa":"novo"'
check "revisar tudo da conta" 200 "$BASE/api/revisar"
contem "revisar tudo inclui o cartão do baralho" "\"id\":$CID,"
check "o baralho conta o cartão como novo" 200 "$BASE/api/baralhos/$BID"
contem "etapas com um novo" '"novos":1'
enviar "nota 7" 400 POST "/api/cartoes/$CID/responder" '{"nota":7}'
contem "erro da nota 7" '{"erro":"nota deve estar entre 0 e 5"}'
enviar "nota -1" 400 POST "/api/cartoes/$CID/responder" '{"nota":-1}'
contem "erro da nota -1" '{"erro":"nota deve estar entre 0 e 5"}'
enviar "nota como string" 400 POST "/api/cartoes/$CID/responder" '{"nota":"3"}'
contem "erro da nota como string" '{"erro":"nota deve estar entre 0 e 5"}'
enviar "corpo que não é JSON" 400 POST "/api/cartoes/$CID/responder" '{nota'
contem "erro do corpo em JSON" '{"erro":"JSON inválido"}'
check "as notas inválidas não alteraram o cartão" 200 "$BASE/api/baralhos/$BID/revisar"
contem "repetições continuam em zero" '"repeticoes":0,'
enviar "responder cartão inexistente" 404 POST /api/cartoes/999999/responder '{"nota":3}'
contem "o 404 de responder vem da API" '{"erro":"cartão não encontrado"}'
check "revisar baralho inexistente" 404 "$BASE/api/baralhos/999999/revisar"
contem "o 404 de revisar vem da API" '{"erro":"baralho não encontrado"}'

enviar "responder nota 4" 200 POST "/api/cartoes/$CID/responder" '{"nota":4}'
contem "intervalo 1" '"intervalo":1,'
contem "próxima revisão amanhã" "\"proximaRevisao\":\"$(date -d tomorrow +%F)\""
check "revisar depois de responder" 200 "$BASE/api/baralhos/$BID/revisar"
nao_contem "o cartão respondido saiu de revisar" "\"id\":$CID,"

psql_db "UPDATE cartoes SET proxima_revisao = current_date - 3 WHERE id = $CID" > /dev/null
check "revisar com cartão atrasado" 200 "$BASE/api/baralhos/$BID/revisar"
contem "o cartão atrasado voltou para revisar" "\"id\":$CID,"

check "estatísticas" 200 "$BASE/api/baralhos/$BID/estatisticas"
PREVISAO=$(LC_ALL=C sed -n 's/.*"previsao":\[\([^]]*\)\].*/\1/p' "$CORPO")
if [ "$(printf '%s' "$PREVISAO" | grep -o '"dia"' | wc -l)" -eq 7 ]; then ok "a previsão tem 7 dias"; else falha "a previsão não tem 7 dias ($PREVISAO)"; fi
contem "o atrasado entra no primeiro dia da previsão" "\"previsao\":[{\"dia\":\"$(date +%F)\",\"quantidade\":1}"
contem "a revisão respondida foi contada" '"totalRevisoes":1'
check "estatísticas de baralho inexistente" 404 "$BASE/api/baralhos/999999/estatisticas"
contem "o 404 de estatísticas vem da API" '{"erro":"baralho não encontrado"}'

check "id não numérico" 404 "$BASE/api/baralhos/abc"
contem "o 404 de id não numérico vem em JSON" '{"erro":"rota não encontrada"}'
check "rota inexistente na API" 404 "$BASE/api/nada"
contem "o 404 de rota inexistente vem em JSON" '{"erro":"rota não encontrada"}'
check "responder com corpo que não é JSON" 415 -X POST -H 'Content-Type: text/plain' --data-binary '{"nota":4}' "$BASE/api/cartoes/$CID/responder"
contem "o 415 vem em JSON" '{"erro":"o corpo deve ser enviado como application/json"}'

# Respostas simultâneas ao mesmo cartão: cada 200 corresponde a um passo do SM-2 e a uma revisão gravada.
enviar "cartão para respostas simultâneas" 201 POST "/api/baralhos/$BID/cartoes" '{"frente":"corrida","verso":"x"}'
RID=$(ultimo_id)
printf '%s' '{"nota":4}' > "$ENVIO"
# Dez, não mais: cada nota 4 aceita multiplica o intervalo, e dezenas delas levam a data além do que o banco guarda.
seq 10 | xargs -P 10 -I{} curl -s -b "$JAR" -o /dev/null -w '%{http_code}\n' \
  -X POST -H 'Content-Type: application/json' --data-binary "@$ENVIO" "$BASE/api/cartoes/$RID/responder" > "$TMP/corrida"
ACEITAS=$(grep -c '^200$' "$TMP/corrida" || true)
OUTRAS=$(grep -cv '^\(200\|409\)$' "$TMP/corrida" || true)
REVISOES=$(psql_db "SELECT count(*) FROM revisoes WHERE cartao_id = $RID")
REPETICOES=$(psql_db "SELECT repeticoes FROM cartoes WHERE id = $RID")
if [ "$OUTRAS" = "0" ]; then ok "respostas simultâneas dão 200 ou 409"; else falha "respostas simultâneas com status inesperado: $(sort "$TMP/corrida" | uniq -c | tr '\n' ' ')"; fi
if [ "$ACEITAS" = "$REVISOES" ] && [ "$ACEITAS" = "$REPETICOES" ]; then ok "cada resposta aceita virou uma revisão e uma repetição ($ACEITAS)"; else falha "aceitas $ACEITAS, revisões $REVISOES, repetições $REPETICOES"; fi

check "o resumo da conta" 200 "$BASE/api/resumo"
contem "o resumo conta as revisões de hoje" "\"revisoesHoje\":$((ACEITAS + 1))"
contem "o resumo tem sequência de um dia" '"sequencia":1'
PROXIMOS=$(LC_ALL=C sed -n 's/.*"proximos":\[\(.*\)\],"revisoesHoje".*/\1/p' "$CORPO")
if [ "$(printf '%s' "$PROXIMOS" | grep -o '"dia"' | wc -l)" -eq 14 ]; then ok "os próximos têm 14 dias"; else falha "os próximos não têm 14 dias ($PROXIMOS)"; fi
contem "os próximos começam amanhã" "\"proximos\":[{\"baralhos\":[],\"dia\":\"$(date -d tomorrow +%F)\""
psql_db "UPDATE cartoes SET proxima_revisao = '$(date -d tomorrow +%F)' WHERE id = $CID" > /dev/null
check "o resumo com um cartão para amanhã" 200 "$BASE/api/resumo"
contem "o cartão de amanhã aparece no primeiro dia com o baralho" "\"proximos\":[{\"baralhos\":[{\"id\":$BID,"

# Isolamento: Beto não enxerga nem altera nada da Ana, e cada recurso alheio responde como inexistente.
JAR="$TMP/sessao-beto"
enviar "cadastro de Beto" 201 POST /api/contas "{\"nome\":\"Beto\",\"email\":\"$EMAIL_BETO\",\"senha\":\"Segredo#123\"}"
check "Beto lista os próprios baralhos" 200 "$BASE/api/baralhos"
nao_contem "a lista de Beto não tem o baralho da Ana" "\"id\":$BID,"
check "Beto não abre o baralho da Ana" 404 "$BASE/api/baralhos/$BID"
contem "o baralho alheio parece inexistente" '{"erro":"baralho não encontrado"}'
check "Beto não lista os cartões da Ana" 404 "$BASE/api/baralhos/$BID/cartoes"
check "Beto não vê as estatísticas da Ana" 404 "$BASE/api/baralhos/$BID/estatisticas"
check "Beto não revisa o baralho da Ana" 404 "$BASE/api/baralhos/$BID/revisar"
enviar "Beto não cria cartão no baralho da Ana" 404 POST "/api/baralhos/$BID/cartoes" '{"frente":"x","verso":"y"}'
enviar "Beto não edita o cartão da Ana" 404 PUT "/api/cartoes/$CID" '{"frente":"invadido","verso":"y"}'
contem "o cartão alheio parece inexistente" '{"erro":"cartão não encontrado"}'
enviar "Beto não responde o cartão da Ana" 404 POST "/api/cartoes/$CID/responder" '{"nota":5}'
check "Beto não exclui o cartão da Ana" 404 -X DELETE "$BASE/api/cartoes/$CID"
check "Beto não exclui o baralho da Ana" 404 -X DELETE "$BASE/api/baralhos/$BID"
enviar "Beto não edita o baralho da Ana" 404 PUT "/api/baralhos/$BID" '{"nome":"invadido"}'
check "o revisar tudo de Beto não traz cartões da Ana" 200 "$BASE/api/revisar"
nao_contem "nenhum cartão da Ana no revisar de Beto" "\"id\":$CID,"
check "as preferências de Beto são as padrão" 200 "$BASE/api/preferencias"
contem "Beto não herda o tema da Ana" '"tema":"sistema"'
check "o resumo de Beto começa zerado" 200 "$BASE/api/resumo"
contem "Beto não tem revisões" '"revisoesHoje":0'
JAR="$TMP/sessao-ana"
check "o cartão da Ana continua intacto" 200 "$BASE/api/baralhos/$BID/cartoes"
contem "a frente da Ana não mudou" '"frente":"Ação 🧠 editada"'

# Por último, depois das revisões, para que a cascata leve cartões e revisões juntos.
check "excluir baralho" 204 -X DELETE "$BASE/api/baralhos/$BID"
check "o baralho excluído dá 404" 404 "$BASE/api/baralhos/$BID"
enviar "o cartão do baralho excluído dá 404" 404 PUT "/api/cartoes/$CID" '{"frente":"x","verso":"y"}'
if [ "$(psql_db "SELECT count(*) FROM revisoes WHERE cartao_id = $CID")" = "0" ]; then ok "as revisões foram removidas em cascata"; else falha "sobraram revisões do cartão $CID"; fi
check "excluir baralho inexistente" 404 -X DELETE "$BASE/api/baralhos/$BID"

# As contas do smoke saem por último; a cascata leva sessões e baralhos que sobrarem.
psql_db "DELETE FROM usuarios WHERE email IN ('$EMAIL_ANA', '$EMAIL_BETO')" > /dev/null

if [ "$FALHAS" -gt 0 ]; then echo "$FALHAS falha(s)"; exit 1; fi
echo "Todos OK"
