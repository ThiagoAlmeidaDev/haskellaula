{-# LANGUAGE OverloadedStrings #-}

{- | Testes do núcleo puro (SM-2, estatísticas, resumo, validação e JSON de baralhos, cartões e
contas). Roda com cabal test, sem banco nem servidor.
-}
module Main where

import Data.Aeson (Value (..), decode, eitherDecode, encode, object, toJSON, (.=))
import qualified Data.Aeson.KeyMap as KM
import Data.Either (isLeft)
import Data.List (isSuffixOf)
import Data.Maybe (mapMaybe)
import qualified Data.Text as T
import Data.Time (Day, addDays, fromGregorian)
import Test.Hspec
import Test.QuickCheck

import Nucleo.Conta
import Nucleo.Preferencias
import Nucleo.SM2
import Nucleo.Stats
import Nucleo.Types

{-
Tópico: regra de domínio, contrato JSON.
Motivo: fixar o SM-2 clássico (Wozniak, 1990), a validação de entrada e o formato JSON
que o frontend consome; os valores esperados saem das regras do SM-2 e do contrato da API.
-}

dia :: Day
dia = fromGregorian 2026 11 13

cartao :: Int -> Double -> Day -> Cartao
cartao i fac prox = Cartao i 1 "f" "v" fac 0 0 prox

nota :: Int -> Nota
nota n = maybe (error ("nota inválida no teste: " ++ show n)) id (mkNota n)

responderVarias :: Day -> [Nota] -> EstadoCartao -> EstadoCartao
responderVarias hoje notas e = foldl (\acc n -> responder n hoje acc) e notas

genNotas :: Gen [Nota]
genNotas = mapMaybe mkNota <$> listOf (choose (0, 5))

genDia :: Gen Day
genDia = addDays <$> choose (-3650, 3650) <*> pure dia

prop_facilidadeMinima :: Property
prop_facilidadeMinima = forAll genNotas $ \notas ->
    facilidade (responderVarias dia notas (estadoInicial dia)) >= 1.3

prop_proximaDepoisDeHoje :: Property
prop_proximaDepoisDeHoje =
    forAll genNotas $ \historico ->
    forAll (choose (0, 5)) $ \n ->
    forAll genDia $ \hoje ->
        let e = responderVarias dia historico (estadoInicial dia)
        in proximaRevisao (responder (nota n) hoje e) > hoje

main :: IO ()
main = hspec $ do
    describe "SM2" $ do
        -- Quebra: aceitar nota acima de 5 no smart constructor.
        it "recusa nota 6" $
            mkNota 6 `shouldBe` Nothing
        -- Quebra: aceitar nota negativa no smart constructor.
        it "recusa nota -1" $
            mkNota (-1) `shouldBe` Nothing
        -- Quebra: perder o valor ao embrulhar a nota.
        it "preserva o valor de uma nota válida" $
            fmap notaValor (mkNota 5) `shouldBe` Just 5

        -- Quebra: errar o intervalo da primeira repetição ou mexer na facilidade com nota 4.
        it "primeira resposta com nota 4 agenda para amanhã" $
            responder (nota 4) dia (estadoInicial dia)
                `shouldBe` EstadoCartao 2.5 1 1 (addDays 1 dia)
        -- Quebra: errar o intervalo fixo da segunda repetição.
        it "segunda resposta com nota 4 dá intervalo 6" $
            intervalo (responderVarias dia [nota 4, nota 4] (estadoInicial dia))
                `shouldBe` 6
        -- Quebra: usar a facilidade antiga no produto, ou não arredondar.
        it "terceira resposta com nota 5 multiplica pelo novo fator" $ do
            let e = responder (nota 5) dia (EstadoCartao 2.5 6 2 dia)
            facilidade e `shouldSatisfy` (\f -> abs (f - 2.6) < 1e-9)
            intervalo e `shouldBe` 16
        -- Quebra: manter as repetições depois de uma nota abaixo de 3.
        it "nota 2 reinicia repetições e intervalo" $ do
            let e = responder (nota 2) dia (responderVarias dia [nota 5, nota 4, nota 5] (estadoInicial dia))
            repeticoes e `shouldBe` 0
            intervalo e `shouldBe` 1
        -- Quebra: remover o piso de 1.3 da facilidade.
        it "nota 0 não baixa a facilidade de 1.3" $
            facilidade (responder (nota 0) dia (EstadoCartao 1.3 6 2 dia))
                `shouldBe` 1.3
        -- Quebra: remover o piso de 1.3 em alguma sequência de notas.
        it "a facilidade nunca fica abaixo de 1.3" $
            property prop_facilidadeMinima
        -- Quebra: agendar a próxima revisão para hoje ou antes.
        it "a próxima revisão é sempre depois de hoje" $
            property prop_proximaDepoisDeHoje

    describe "Validação" $ do
        -- Quebra: comparar com vazio sem aplicar strip.
        it "recusa frente só com espaços" $
            validarNovoCartao (NovoCartao "  " "x") `shouldBe` Left "frente é obrigatória"
        -- Quebra: validar só a frente.
        it "recusa verso vazio" $
            validarNovoCartao (NovoCartao "x" "") `shouldBe` Left "verso é obrigatório"
        -- Quebra: usar um strip que também mexe no meio do texto.
        it "o strip preserva os espaços internos" $
            validarNovoCartao (NovoCartao "  Olá mundo " "x") `shouldBe` Right (NovoCartao "Olá mundo" "x")
        -- Quebra: aceitar baralho sem nome.
        it "recusa nome de baralho em branco" $
            validarNovoBaralho (NovoBaralho " \t " "d" visualPadrao) `shouldBe` Left "nome é obrigatório"
        -- Quebra: deixar a nota fora de 0 a 5 chegar ao SM-2.
        it "recusa nota 7" $
            fmap notaValor (validarResposta (Resposta 7)) `shouldBe` Left "nota deve estar entre 0 e 5"
        -- Quebra: aceitar nota negativa.
        it "recusa nota -1" $
            validarResposta (Resposta (-1)) `shouldSatisfy` isLeft
        -- Quebra: converter a string "3" em nota.
        it "recusa nota enviada como string" $
            (eitherDecode "{\"nota\":\"3\"}" :: Either String Resposta)
                `shouldSatisfy` either ("nota deve estar entre 0 e 5" `isSuffixOf`) (const False)
        -- Quebra: perder ou trocar bytes de texto não ASCII na serialização.
        it "o JSON de um cartão preserva acentos e emoji" $ do
            let c = Cartao 1 2 "Ação 🧠" "日本" 2.5 0 0 dia
            decode (encode c) `shouldBe` Just c
        -- Quebra: renomear uma chave que o frontend lê.
        it "o JSON de um cartão usa as chaves do contrato" $
            toJSON (Cartao 1 2 "f" "v" 2.5 6 2 dia) `shouldBe` object
                [ "id" .= (1 :: Int), "baralhoId" .= (2 :: Int), "frente" .= ("f" :: String)
                , "verso" .= ("v" :: String), "facilidade" .= (2.5 :: Double), "intervalo" .= (6 :: Int)
                , "repeticoes" .= (2 :: Int), "proximaRevisao" .= ("2026-11-13" :: String)
                , "etapa" .= ("aprendendo" :: String) ]
        -- Quebra: expor o nome do campo Haskell no lugar de id.
        it "o JSON de um baralho usa as chaves do contrato" $
            toJSON (Baralho 3 "n" "d" 4 1 (Etapas 2 1 1) (Visual Tomate Listras)) `shouldBe` object
                [ "id" .= (3 :: Int), "nome" .= ("n" :: String), "descricao" .= ("d" :: String)
                , "totalCartoes" .= (4 :: Int), "paraHoje" .= (1 :: Int)
                , "cor" .= ("tomate" :: String), "padrao" .= ("listras" :: String)
                , "etapas" .= object [ "novos" .= (2 :: Int), "aprendendo" .= (1 :: Int), "dominados" .= (1 :: Int) ] ]
        -- Quebra: tornar a descrição obrigatória no corpo do POST.
        it "a descrição do baralho é opcional no corpo" $
            decode "{\"nome\":\"n\"}" `shouldBe` Just (NovoBaralho "n" "" visualPadrao)
        -- Quebra: ignorar a cor ou o padrão enviados no corpo.
        it "o corpo do baralho aceita cor e padrão" $
            decode "{\"nome\":\"n\",\"cor\":\"hortela\",\"padrao\":\"bolinhas\"}" `shouldBe` Just (NovoBaralho "n" "" (Visual Hortela Bolinhas))
        -- Quebra: aceitar uma cor fora da paleta, que o frontend não sabe desenhar.
        it "recusa cor fora da paleta" $
            (eitherDecode "{\"nome\":\"n\",\"cor\":\"roxo\"}" :: Either String NovoBaralho)
                `shouldSatisfy` either ("cor inválida" `isSuffixOf`) (const False)
        -- Quebra: aceitar um padrão desconhecido.
        it "recusa padrão desconhecido" $
            (eitherDecode "{\"nome\":\"n\",\"padrao\":\"zebra\"}" :: Either String NovoBaralho)
                `shouldSatisfy` either ("padrão inválido" `isSuffixOf`) (const False)

    describe "Preferencias" $ do
        let completo = "{\"tamanhoPergunta\":4,\"tamanhoResposta\":2,\"mostrarPergunta\":false,\"revelar\":\"abaixo\",\"fonte\":\"manuscrita\",\"tema\":\"escuro\",\"embaralhar\":true}"
        -- Quebra: trocar o padrão de quem nunca salvou preferências.
        it "o padrão é texto médio, pergunta visível, virar, sem serifa, tema do sistema e ordem agendada" $
            preferenciasPadrao `shouldBe` Preferencias 3 3 True Virar SemSerifa Sistema False
        -- Quebra: ler algum campo no lugar de outro.
        it "lê o corpo completo" $
            decode completo `shouldBe` Just (Preferencias 4 2 False Abaixo Manuscrita Escuro True)
        -- Quebra: perder valores no caminho de ida e volta do JSON.
        it "o JSON de ida e volta preserva tudo" $
            decode (encode (Preferencias 5 1 True Abaixo Serifa Claro False)) `shouldBe` Just (Preferencias 5 1 True Abaixo Serifa Claro False)
        -- Quebra: voltar a escala para 5 passos.
        it "aceita tamanho 8, o maior da escala" $
            fmap tamanhoPergunta (decode "{\"tamanhoPergunta\":8,\"tamanhoResposta\":8,\"mostrarPergunta\":true,\"revelar\":\"virar\",\"fonte\":\"serifa\",\"tema\":\"claro\",\"embaralhar\":false}") `shouldBe` Just 8
        -- Quebra: aceitar tamanho acima da escala de 8 passos.
        it "recusa tamanho 9" $
            (eitherDecode "{\"tamanhoPergunta\":9,\"tamanhoResposta\":2,\"mostrarPergunta\":true,\"revelar\":\"virar\",\"fonte\":\"serifa\",\"tema\":\"claro\",\"embaralhar\":false}" :: Either String Preferencias)
                `shouldSatisfy` either ("o tamanho do texto deve estar entre 1 e 8" `isSuffixOf`) (const False)
        -- Quebra: aceitar tamanho zero.
        it "recusa tamanho 0" $
            (eitherDecode "{\"tamanhoPergunta\":3,\"tamanhoResposta\":0,\"mostrarPergunta\":true,\"revelar\":\"virar\",\"fonte\":\"serifa\",\"tema\":\"claro\",\"embaralhar\":false}" :: Either String Preferencias)
                `shouldSatisfy` either ("o tamanho do texto deve estar entre 1 e 8" `isSuffixOf`) (const False)
        -- Quebra: aceitar um jeito de revelar que a sessão não sabe mostrar.
        it "recusa revelar desconhecido" $
            (eitherDecode "{\"tamanhoPergunta\":3,\"tamanhoResposta\":3,\"mostrarPergunta\":true,\"revelar\":\"girar\",\"fonte\":\"serifa\",\"tema\":\"claro\",\"embaralhar\":false}" :: Either String Preferencias)
                `shouldSatisfy` either ("revelar deve ser virar ou abaixo" `isSuffixOf`) (const False)
        -- Quebra: aceitar texto onde se espera verdadeiro ou falso.
        it "recusa mostrarPergunta como texto" $
            (eitherDecode "{\"tamanhoPergunta\":3,\"tamanhoResposta\":3,\"mostrarPergunta\":\"sim\",\"revelar\":\"virar\",\"fonte\":\"serifa\",\"tema\":\"claro\",\"embaralhar\":false}" :: Either String Preferencias)
                `shouldSatisfy` either ("mostrarPergunta deve ser verdadeiro ou falso" `isSuffixOf`) (const False)
        -- Quebra: aceitar um tema que o CSS não tem.
        it "recusa tema desconhecido" $
            (eitherDecode "{\"tamanhoPergunta\":3,\"tamanhoResposta\":3,\"mostrarPergunta\":true,\"revelar\":\"virar\",\"fonte\":\"serifa\",\"tema\":\"neon\",\"embaralhar\":false}" :: Either String Preferencias)
                `shouldSatisfy` either ("tema inválido" `isSuffixOf`) (const False)
        -- Quebra: renomear uma chave que o frontend lê.
        it "o JSON das preferências usa as chaves do contrato" $
            toJSON preferenciasPadrao `shouldBe` object
                [ "tamanhoPergunta" .= (3 :: Int), "tamanhoResposta" .= (3 :: Int), "mostrarPergunta" .= True
                , "revelar" .= ("virar" :: String), "fonte" .= ("sem-serifa" :: String)
                , "tema" .= ("sistema" :: String), "embaralhar" .= False ]

    describe "Etapa" $ do
        -- Quebra: tratar como aprendendo um cartão que nunca foi respondido.
        it "cartão sem repetição e sem intervalo é novo" $
            etapaDe 0 0 `shouldBe` Novo
        -- Quebra: devolver ao estado de novo o cartão que acabou de ser errado.
        it "cartão errado, com intervalo de 1 dia, está aprendendo" $
            etapaDe 0 1 `shouldBe` Aprendendo
        -- Quebra: baixar o limite de dominado para menos de 21 dias.
        it "intervalo de 20 dias ainda está aprendendo" $
            etapaDe 3 20 `shouldBe` Aprendendo
        -- Quebra: subir o limite de dominado para mais de 21 dias. Origem: o limite de cartão maduro do Anki.
        it "intervalo de 21 dias está dominado" $
            etapaDe 4 21 `shouldBe` Dominado
        -- Quebra: contar uma etapa no lugar de outra.
        it "conta as etapas de uma lista de cartões" $
            contarEtapas [(0, 0), (1, 1), (5, 30), (0, 0)] `shouldBe` Etapas 2 1 1

    describe "Revisão" $ do
        let prazos c = [(n, d) | Previsao n d <- previsoesDe dia c]
        -- Quebra: mostrar para um cartão novo um prazo diferente do que o SM-2 vai gravar.
        it "num cartão novo toda nota volta em 1 dia" $
            prazos (cartao 1 2.5 dia) `shouldBe` [(n, 1) | n <- [0 .. 5]]
        -- Quebra: calcular o prazo por outra regra que não a do responder. Origem: tabela do SM-2.
        it "na terceira repetição os prazos das notas 3, 4 e 5 são 14, 15 e 16 dias" $
            prazos (Cartao 1 1 "f" "v" 2.5 6 2 dia) `shouldBe` [(0, 1), (1, 1), (2, 1), (3, 14), (4, 15), (5, 16)]
        -- Quebra: perder as previsões ou o cartão no JSON da revisão.
        it "o JSON do cartão a revisar traz o cartão e as previsões" $
            toJSON (paraRevisar dia (cartao 7 2.5 dia)) `shouldSatisfy` \v -> case v of
                Object o -> KM.member "frente" o && KM.member "previsoes" o
                _        -> False

    describe "Stats" $ do
        let semNada = calcularEstatisticas dia [] []
        -- Quebra: dividir por zero quando não há revisões.
        it "sem revisões a taxa de acerto é 0" $
            eTaxaAcerto semNada `shouldBe` 0
        -- Quebra: omitir os dias sem cartão da previsão.
        it "sem cartões a previsão tem 7 dias zerados a partir de hoje" $
            ePrevisao semNada `shouldBe` [(addDays i dia, 0) | i <- [0 .. 6]]
        -- Quebra: deixar o cartão atrasado fora do balde de hoje.
        it "o cartão atrasado conta no primeiro dia da previsão" $
            take 1 (ePrevisao (calcularEstatisticas dia [cartao 1 2.5 (addDays (-3) dia)] []))
                `shouldBe` [(dia, 1)]
        -- Quebra: contar para hoje um cartão agendado para amanhã, ou esquecer o atrasado.
        it "para hoje conta os atrasados e os de hoje" $
            eParaHoje (calcularEstatisticas dia
                [cartao 1 2.5 (addDays (-3) dia), cartao 2 2.5 dia, cartao 3 2.5 (addDays 1 dia)] [])
                `shouldBe` 2
        -- Quebra: contar nota 2 como acerto, ou dividir pelo número de cartões.
        it "notas 5, 4, 2 e 1 dão taxa de acerto 0.5" $
            eTaxaAcerto (calcularEstatisticas dia [] [(dia, n) | n <- [5, 4, 2, 1]]) `shouldBe` 0.5
        -- Quebra: não limitar a 5, não ordenar, ou incluir facilidade 2.0 ou maior.
        it "os difíceis são as 5 menores facilidades abaixo de 2.0 em ordem crescente" $
            map cFacilidade (eDificeis (calcularEstatisticas dia
                [cartao i f dia | (i, f) <- zip [1 ..] [1.9, 1.3, 1.8, 2.0, 1.5, 1.4, 2.5, 1.7, 1.6]] []))
                `shouldBe` [1.3, 1.4, 1.5, 1.6, 1.7]
        -- Quebra: desempatar por outra coisa que não o id.
        it "difíceis com a mesma facilidade saem por id" $
            map cartaoId (eDificeis (calcularEstatisticas dia [cartao 9 1.5 dia, cartao 2 1.5 dia] []))
                `shouldBe` [2, 9]
        -- Quebra: mudar a janela de 30 dias ou não terminar em hoje.
        it "revisões por dia tem 30 itens de hoje-29 até hoje" $
            map fst (eRevisoesPorDia semNada) `shouldBe` [addDays i dia | i <- [-29 .. 0]]
        -- Quebra: agrupar a revisão num dia diferente do informado.
        it "a revisão de hoje conta no último dia" $
            drop 29 (eRevisoesPorDia (calcularEstatisticas dia [] [(dia, 4), (dia, 1), (addDays (-1) dia, 3)]))
                `shouldBe` [(dia, 2)]

    describe "Resumo" $ do
        let resumo r = calcularResumo dia r []
        -- Quebra: começar a sequência de um dia sem revisão.
        it "sem revisões a sequência é zero" $
            resSequencia (resumo []) `shouldBe` 0
        -- Quebra: contar só a última revisão de cada dia.
        it "conta todas as revisões de hoje" $
            resRevisoesHoje (resumo [dia, dia, addDays (-1) dia]) `shouldBe` 2
        -- Quebra: parar a contagem antes do primeiro dia sem revisão.
        it "três dias seguidos terminando hoje dão sequência 3" $
            resSequencia (resumo [dia, addDays (-1) dia, addDays (-2) dia]) `shouldBe` 3
        -- Quebra: zerar a sequência antes de o dia de hoje acabar.
        it "sem revisão hoje a sequência continua a partir de ontem" $
            resSequencia (resumo [addDays (-1) dia, addDays (-2) dia]) `shouldBe` 2
        -- Quebra: pular o dia vazio no meio da sequência.
        it "um dia sem revisão interrompe a sequência" $
            resSequencia (resumo [dia, addDays (-2) dia, addDays (-3) dia]) `shouldBe` 1
        -- Quebra: aceitar uma sequência que terminou anteontem.
        it "a última revisão anteontem não forma sequência" $
            resSequencia (resumo [addDays (-2) dia]) `shouldBe` 0
        -- Quebra: somar cada revisão como um dia de sequência.
        it "várias revisões no mesmo dia contam um dia só" $
            resSequencia (resumo [dia, dia, dia]) `shouldBe` 1
        -- Quebra: mudar a janela de 14 dias ou não terminar em hoje.
        it "a atividade tem 14 dias de hoje-13 até hoje" $
            map fst (resAtividade (resumo [])) `shouldBe` [addDays i dia | i <- [-13 .. 0]]
        -- Quebra: perder a contagem diária da atividade.
        it "a atividade soma as revisões de cada dia" $
            drop 12 (resAtividade (resumo [dia, addDays (-1) dia, dia])) `shouldBe` [(addDays (-1) dia, 1), (dia, 2)]

    describe "Resumo, próximos dias" $ do
        let proximos = resProximos . calcularResumo dia []
            agendado d = Agendado (addDays d dia)
            doDia d = filter ((== addDays d dia) . pxDia) . proximos
        -- Quebra: mudar a janela de 14 dias ou começar em hoje em vez de amanhã.
        it "os próximos vão de amanhã até hoje+14" $
            map pxDia (proximos []) `shouldBe` [addDays i dia | i <- [1 .. 14]]
        -- Quebra: esconder o dia sem cartas em vez de mostrá-lo com zero.
        it "dia sem cartas tem quantidade zero e nenhum baralho" $
            map (\p -> (pxQuantidade p, pxBaralhos p)) (doDia 3 [agendado 2 1 "Japonês" 4])
                `shouldBe` [(0, [])]
        -- Quebra: contar só um dos baralhos que caem no mesmo dia.
        it "a quantidade do dia soma todos os baralhos" $
            map pxQuantidade (doDia 2 [agendado 2 1 "Japonês" 3, agendado 2 2 "Capitais" 5]) `shouldBe` [8]
        -- Quebra: listar os baralhos do dia fora da ordem do que tem mais cartas.
        it "os baralhos do dia vêm do que tem mais cartas para o que tem menos" $
            map (map agBaralho . pxBaralhos) (doDia 2 [agendado 2 1 "Japonês" 3, agendado 2 2 "Capitais" 5, agendado 2 3 "Química" 1])
                `shouldBe` [["Capitais", "Japonês", "Química"]]
        -- Quebra: desempatar baralhos com a mesma quantidade por algo além do nome.
        it "empate na quantidade fica em ordem de nome" $
            map (map agBaralho . pxBaralhos) (doDia 5 [agendado 5 1 "Química" 2, agendado 5 2 "Anatomia" 2])
                `shouldBe` [["Anatomia", "Química"]]
        -- Quebra: somar nos próximos dias o que é de hoje, atrasado ou além da janela.
        it "ignora cartas de hoje, atrasadas e depois de hoje+14" $
            sum (map pxQuantidade (proximos [agendado 0 1 "A" 2, agendado (-3) 1 "A" 4, agendado 15 1 "A" 7]))
                `shouldBe` 0
        -- Quebra: renomear uma chave que o painel lê.
        it "o JSON de um dia usa as chaves do contrato" $
            toJSON (Proximo (addDays 1 dia) 3 [Agendado (addDays 1 dia) 7 "Japonês" 3]) `shouldBe` object
                [ "dia" .= addDays 1 dia, "quantidade" .= (3 :: Int)
                , "baralhos" .= [object ["id" .= (7 :: Int), "nome" .= ("Japonês" :: String), "quantidade" .= (3 :: Int)]] ]

    describe "Conta" $ do
        let conta = NovaConta "Ana" "ana@exemplo.com" "Segredo#123"
        -- Quebra: aceitar conta sem nome.
        it "recusa nome em branco" $
            validarNovaConta conta { contaNome = "  " } `shouldBe` Left "informe seu nome"
        -- Quebra: remover o limite de tamanho do nome.
        it "recusa nome com mais de 80 caracteres" $
            validarNovaConta conta { contaNome = T.replicate 81 "a" } `shouldBe` Left "o nome deve ter no máximo 80 caracteres"
        -- Quebra: guardar o nome com os espaços das pontas.
        it "tira os espaços das pontas do nome" $
            fmap contaNome (validarNovaConta conta { contaNome = "  Ana Lima " }) `shouldBe` Right "Ana Lima"
        -- Quebra: diferenciar o mesmo e-mail por caixa ou espaço, criando duas contas para a mesma pessoa.
        it "normaliza o e-mail para minúsculas e sem espaços nas pontas" $
            fmap contaEmail (validarNovaConta conta { contaEmail = "  Ana@Exemplo.COM " }) `shouldBe` Right "ana@exemplo.com"
        -- Quebra: aceitar e-mail sem arroba.
        it "recusa e-mail sem arroba" $
            validarNovaConta conta { contaEmail = "ana.exemplo.com" } `shouldBe` Left "e-mail inválido"
        -- Quebra: aceitar e-mail com duas arrobas.
        it "recusa e-mail com duas arrobas" $
            validarNovaConta conta { contaEmail = "ana@x@exemplo.com" } `shouldBe` Left "e-mail inválido"
        -- Quebra: aceitar domínio sem ponto.
        it "recusa domínio sem ponto" $
            validarNovaConta conta { contaEmail = "ana@localhost" } `shouldBe` Left "e-mail inválido"
        -- Quebra: aceitar espaço no meio do e-mail.
        it "recusa e-mail com espaço interno" $
            validarNovaConta conta { contaEmail = "ana maria@exemplo.com" } `shouldBe` Left "e-mail inválido"
        -- Quebra: aceitar e-mail sem a parte antes da arroba.
        it "recusa e-mail sem usuário" $
            validarNovaConta conta { contaEmail = "@exemplo.com" } `shouldBe` Left "e-mail inválido"
        -- Quebra: baixar o mínimo de 8 caracteres da senha.
        it "recusa senha com 7 caracteres" $
            validarNovaConta conta { contaSenha = "Ab#1234" } `shouldBe` Left "a senha deve ter pelo menos 8 caracteres"
        -- Quebra: aplicar strip na senha, que deixaria de ser a que a pessoa digitou.
        it "preserva os espaços da senha" $
            fmap contaSenha (validarNovaConta conta { contaSenha = "  Segr#d0  " }) `shouldBe` Right "  Segr#d0  "
        -- Quebra: recusar a senha de 72 bytes. Origem: o bcrypt usa no máximo 72 bytes da senha.
        it "aceita senha de 72 bytes" $
            fmap contaSenha (validarNovaConta conta { contaSenha = "Aa#1" <> T.replicate 68 "a" }) `shouldBe` Right ("Aa#1" <> T.replicate 68 "a")
        -- Quebra: medir a senha em caracteres. Origem: 37 vezes "é" são 37 caracteres e 74 bytes em UTF-8.
        it "recusa senha acima de 72 bytes mesmo com menos de 72 caracteres" $
            validarNovaConta conta { contaSenha = "Aa#1" <> T.replicate 35 "é" } `shouldBe` Left "a senha é longa demais"
        -- Quebra: aceitar senha sem letra maiúscula.
        it "recusa senha sem letra maiúscula" $
            validarNovaConta conta { contaSenha = "segredo#123" } `shouldBe` Left "a senha precisa de uma letra maiúscula"
        -- Quebra: aceitar senha sem letra minúscula.
        it "recusa senha sem letra minúscula" $
            validarNovaConta conta { contaSenha = "SEGREDO#123" } `shouldBe` Left "a senha precisa de uma letra minúscula"
        -- Quebra: aceitar senha sem número.
        it "recusa senha sem número" $
            validarNovaConta conta { contaSenha = "Segredo#abc" } `shouldBe` Left "a senha precisa de um número"
        -- Quebra: aceitar senha sem símbolo.
        it "recusa senha sem símbolo" $
            validarNovaConta conta { contaSenha = "Segredo1234" } `shouldBe` Left "a senha precisa de um símbolo"
        -- Quebra: contar o espaço como símbolo.
        it "o espaço não conta como símbolo" $
            validarNovaConta conta { contaSenha = "Segredo 123" } `shouldBe` Left "a senha precisa de um símbolo"
        -- Quebra: tratar letra acentuada como símbolo ou não reconhecer a maiúscula acentuada.
        it "letra acentuada conta como letra" $
            fmap contaSenha (validarNovaConta conta { contaSenha = "Água#1234" }) `shouldBe` Right "Água#1234"
        -- Quebra: validar a força da senha no login, que só deve conferir o hash.
        it "o login aceita senha fora da regra do cadastro" $
            validarCredenciais (Credenciais "ana@exemplo.com" "abc") `shouldBe` Right (Credenciais "ana@exemplo.com" "abc")
        -- Quebra: deixar de normalizar o e-mail no login, que então não acharia a conta.
        it "o login normaliza o e-mail" $
            validarCredenciais (Credenciais " Ana@Exemplo.com " "x") `shouldBe` Right (Credenciais "ana@exemplo.com" "x")
        -- Quebra: consultar o banco com senha vazia.
        it "o login recusa senha vazia" $
            validarCredenciais (Credenciais "ana@exemplo.com" "") `shouldBe` Left "informe e-mail e senha"
        -- Quebra: consultar o banco com e-mail em branco.
        it "o login recusa e-mail em branco" $
            validarCredenciais (Credenciais "  " "segredo123") `shouldBe` Left "informe e-mail e senha"
        -- Quebra: expor o hash da senha ou renomear uma chave que o frontend lê.
        it "o JSON do usuário tem só id, nome e e-mail" $
            toJSON (Usuario 7 "Ana" "ana@exemplo.com") `shouldBe` object
                [ "id" .= (7 :: Int), "nome" .= ("Ana" :: String), "email" .= ("ana@exemplo.com" :: String) ]
        -- Quebra: aceitar corpo de cadastro sem a senha.
        it "o corpo de cadastro sem senha é recusado com a mensagem da validação" $
            (eitherDecode "{\"nome\":\"Ana\",\"email\":\"ana@exemplo.com\"}" :: Either String NovaConta)
                `shouldSatisfy` either ("a senha deve ter pelo menos 8 caracteres" `isSuffixOf`) (const False)
        -- Quebra: aceitar corpo de login sem e-mail.
        it "o corpo de login sem e-mail é recusado com a mensagem da validação" $
            (eitherDecode "{\"senha\":\"x\"}" :: Either String Credenciais)
                `shouldSatisfy` either ("informe e-mail e senha" `isSuffixOf`) (const False)
