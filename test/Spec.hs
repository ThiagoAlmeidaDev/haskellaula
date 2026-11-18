{-# LANGUAGE OverloadedStrings #-}

{- | Testes do Nucleo: SM-2, estatísticas, resumo, validação e o JSON de baralhos, cartões e
contas. Rodam com cabal test, sem banco e sem servidor.

Os valores esperados vêm das regras do SM-2 clássico (Wozniak, 1990) e das chaves de JSON que o
frontend lê. Se um teste de JSON quebrar, provavelmente alguma tela do frontend quebrou junto.
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

dia :: Day
dia = fromGregorian 2026 11 13

cartao :: Int -> Double -> Day -> Cartao
cartao idCartao facilidadeInicial proxima = Cartao idCartao 1 "f" "v" facilidadeInicial 0 0 proxima

nota :: Int -> Nota
nota valor = maybe (error ("nota inválida no teste: " ++ show valor)) id (mkNota valor)

responderVarias :: Day -> [Nota] -> EstadoCartao -> EstadoCartao
responderVarias hoje notas estado = foldl (\estadoAtual notaDada -> responder notaDada hoje estadoAtual) estado notas

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
    forAll (choose (0, 5)) $ \valorNota ->
    forAll genDia $ \hoje ->
        let estado = responderVarias dia historico (estadoInicial dia)
        in proximaRevisao (responder (nota valorNota) hoje estado) > hoje

main :: IO ()
main = hspec $ do
    describe "SM2" $ do
        it "recusa nota 6" $
            mkNota 6 `shouldBe` Nothing
        it "recusa nota -1" $
            mkNota (-1) `shouldBe` Nothing
        it "preserva o valor de uma nota válida" $
            fmap notaValor (mkNota 5) `shouldBe` Just 5

        -- Com nota 4 a facilidade não muda: 2.5 + (0.1 - 1 * (0.08 + 1 * 0.02)) = 2.5.
        it "primeira resposta com nota 4 agenda para amanhã" $
            responder (nota 4) dia (estadoInicial dia)
                `shouldBe` EstadoCartao 2.5 1 1 (addDays 1 dia)
        it "segunda resposta com nota 4 dá intervalo 6" $
            intervalo (responderVarias dia [nota 4, nota 4] (estadoInicial dia))
                `shouldBe` 6
        -- O intervalo tem que usar a facilidade nova (2.6), e não a antiga: 6 * 2.6 = 15.6, que arredonda para 16.
        it "terceira resposta com nota 5 multiplica pelo novo fator" $ do
            let estado = responder (nota 5) dia (EstadoCartao 2.5 6 2 dia)
            facilidade estado `shouldSatisfy` (\facilidadeNova -> abs (facilidadeNova - 2.6) < 1e-9)
            intervalo estado `shouldBe` 16
        it "nota 2 reinicia repetições e intervalo" $ do
            let estado = responder (nota 2) dia (responderVarias dia [nota 5, nota 4, nota 5] (estadoInicial dia))
            repeticoes estado `shouldBe` 0
            intervalo estado `shouldBe` 1
        it "nota 0 não baixa a facilidade de 1.3" $
            facilidade (responder (nota 0) dia (EstadoCartao 1.3 6 2 dia))
                `shouldBe` 1.3
        it "a facilidade nunca fica abaixo de 1.3" $
            property prop_facilidadeMinima
        it "a próxima revisão é sempre depois de hoje" $
            property prop_proximaDepoisDeHoje

    describe "Validação" $ do
        it "recusa frente só com espaços" $
            validarNovoCartao (NovoCartao "  " "x") `shouldBe` Left "frente é obrigatória"
        it "recusa verso vazio" $
            validarNovoCartao (NovoCartao "x" "") `shouldBe` Left "verso é obrigatório"
        it "o strip preserva os espaços internos" $
            validarNovoCartao (NovoCartao "  Olá mundo " "x") `shouldBe` Right (NovoCartao "Olá mundo" "x")
        it "recusa nome de baralho em branco" $
            validarNovoBaralho (NovoBaralho " \t " "d" visualPadrao) `shouldBe` Left "nome é obrigatório"
        it "recusa nota 7" $
            fmap notaValor (validarResposta (Resposta 7)) `shouldBe` Left "nota deve estar entre 0 e 5"
        it "recusa nota -1" $
            validarResposta (Resposta (-1)) `shouldSatisfy` isLeft
        it "recusa nota enviada como string" $
            (eitherDecode "{\"nota\":\"3\"}" :: Either String Resposta)
                `shouldSatisfy` either ("nota deve estar entre 0 e 5" `isSuffixOf`) (const False)
        it "o JSON de um cartão preserva acentos e emoji" $ do
            let cartaoComAcento = Cartao 1 2 "Ação 🧠" "日本" 2.5 0 0 dia
            decode (encode cartaoComAcento) `shouldBe` Just cartaoComAcento
        it "o JSON de um cartão usa as chaves do contrato" $
            toJSON (Cartao 1 2 "f" "v" 2.5 6 2 dia) `shouldBe` object
                [ "id" .= (1 :: Int), "baralhoId" .= (2 :: Int), "frente" .= ("f" :: String)
                , "verso" .= ("v" :: String), "facilidade" .= (2.5 :: Double), "intervalo" .= (6 :: Int)
                , "repeticoes" .= (2 :: Int), "proximaRevisao" .= ("2026-11-13" :: String)
                , "etapa" .= ("aprendendo" :: String) ]
        -- O campo Haskell se chama baralhoId, mas a chave no JSON tem que ser "id".
        it "o JSON de um baralho usa as chaves do contrato" $
            toJSON (Baralho 3 "n" "d" 4 1 (Etapas 2 1 1) (Visual Tomate Listras)) `shouldBe` object
                [ "id" .= (3 :: Int), "nome" .= ("n" :: String), "descricao" .= ("d" :: String)
                , "totalCartoes" .= (4 :: Int), "paraHoje" .= (1 :: Int)
                , "cor" .= ("tomate" :: String), "padrao" .= ("listras" :: String)
                , "etapas" .= object [ "novos" .= (2 :: Int), "aprendendo" .= (1 :: Int), "dominados" .= (1 :: Int) ] ]
        it "a descrição do baralho é opcional no corpo" $
            decode "{\"nome\":\"n\"}" `shouldBe` Just (NovoBaralho "n" "" visualPadrao)
        it "o corpo do baralho aceita cor e padrão" $
            decode "{\"nome\":\"n\",\"cor\":\"hortela\",\"padrao\":\"bolinhas\"}" `shouldBe` Just (NovoBaralho "n" "" (Visual Hortela Bolinhas))
        -- O frontend só sabe desenhar as cores da paleta.
        it "recusa cor fora da paleta" $
            (eitherDecode "{\"nome\":\"n\",\"cor\":\"roxo\"}" :: Either String NovoBaralho)
                `shouldSatisfy` either ("cor inválida" `isSuffixOf`) (const False)
        it "recusa padrão desconhecido" $
            (eitherDecode "{\"nome\":\"n\",\"padrao\":\"zebra\"}" :: Either String NovoBaralho)
                `shouldSatisfy` either ("padrão inválido" `isSuffixOf`) (const False)

    describe "Preferencias" $ do
        let completo = "{\"tamanhoPergunta\":4,\"tamanhoResposta\":2,\"mostrarPergunta\":false,\"revelar\":\"abaixo\",\"fonte\":\"manuscrita\",\"tema\":\"escuro\",\"embaralhar\":true}"
        it "o padrão é texto médio, pergunta visível, virar, sem serifa, tema do sistema e ordem agendada" $
            preferenciasPadrao `shouldBe` Preferencias 3 3 True Virar SemSerifa Sistema False
        it "lê o corpo completo" $
            decode completo `shouldBe` Just (Preferencias 4 2 False Abaixo Manuscrita Escuro True)
        it "o JSON de ida e volta preserva tudo" $
            decode (encode (Preferencias 5 1 True Abaixo Serifa Claro False)) `shouldBe` Just (Preferencias 5 1 True Abaixo Serifa Claro False)
        it "aceita tamanho 8, o maior da escala" $
            fmap tamanhoPergunta (decode "{\"tamanhoPergunta\":8,\"tamanhoResposta\":8,\"mostrarPergunta\":true,\"revelar\":\"virar\",\"fonte\":\"serifa\",\"tema\":\"claro\",\"embaralhar\":false}") `shouldBe` Just 8
        it "recusa tamanho 9" $
            (eitherDecode "{\"tamanhoPergunta\":9,\"tamanhoResposta\":2,\"mostrarPergunta\":true,\"revelar\":\"virar\",\"fonte\":\"serifa\",\"tema\":\"claro\",\"embaralhar\":false}" :: Either String Preferencias)
                `shouldSatisfy` either ("o tamanho do texto deve estar entre 1 e 8" `isSuffixOf`) (const False)
        it "recusa tamanho 0" $
            (eitherDecode "{\"tamanhoPergunta\":3,\"tamanhoResposta\":0,\"mostrarPergunta\":true,\"revelar\":\"virar\",\"fonte\":\"serifa\",\"tema\":\"claro\",\"embaralhar\":false}" :: Either String Preferencias)
                `shouldSatisfy` either ("o tamanho do texto deve estar entre 1 e 8" `isSuffixOf`) (const False)
        it "recusa revelar desconhecido" $
            (eitherDecode "{\"tamanhoPergunta\":3,\"tamanhoResposta\":3,\"mostrarPergunta\":true,\"revelar\":\"girar\",\"fonte\":\"serifa\",\"tema\":\"claro\",\"embaralhar\":false}" :: Either String Preferencias)
                `shouldSatisfy` either ("revelar deve ser virar ou abaixo" `isSuffixOf`) (const False)
        it "recusa mostrarPergunta como texto" $
            (eitherDecode "{\"tamanhoPergunta\":3,\"tamanhoResposta\":3,\"mostrarPergunta\":\"sim\",\"revelar\":\"virar\",\"fonte\":\"serifa\",\"tema\":\"claro\",\"embaralhar\":false}" :: Either String Preferencias)
                `shouldSatisfy` either ("mostrarPergunta deve ser verdadeiro ou falso" `isSuffixOf`) (const False)
        it "recusa tema desconhecido" $
            (eitherDecode "{\"tamanhoPergunta\":3,\"tamanhoResposta\":3,\"mostrarPergunta\":true,\"revelar\":\"virar\",\"fonte\":\"serifa\",\"tema\":\"neon\",\"embaralhar\":false}" :: Either String Preferencias)
                `shouldSatisfy` either ("tema inválido" `isSuffixOf`) (const False)
        it "o JSON das preferências usa as chaves do contrato" $
            toJSON preferenciasPadrao `shouldBe` object
                [ "tamanhoPergunta" .= (3 :: Int), "tamanhoResposta" .= (3 :: Int), "mostrarPergunta" .= True
                , "revelar" .= ("virar" :: String), "fonte" .= ("sem-serifa" :: String)
                , "tema" .= ("sistema" :: String), "embaralhar" .= False ]

    describe "Etapa" $ do
        it "cartão sem repetição e sem intervalo é novo" $
            etapaDe 0 0 `shouldBe` Novo
        -- Um cartão errado tem 0 repetições, mas intervalo 1, então não pode voltar a ser "novo".
        it "cartão errado, com intervalo de 1 dia, está aprendendo" $
            etapaDe 0 1 `shouldBe` Aprendendo
        it "intervalo de 20 dias ainda está aprendendo" $
            etapaDe 3 20 `shouldBe` Aprendendo
        -- 21 dias é o limite que o Anki usa para considerar um cartão maduro.
        it "intervalo de 21 dias está dominado" $
            etapaDe 4 21 `shouldBe` Dominado
        it "conta as etapas de uma lista de cartões" $
            contarEtapas [(0, 0), (1, 1), (5, 30), (0, 0)] `shouldBe` Etapas 2 1 1

    describe "Revisão" $ do
        let prazos cartaoTestado = [(valorNota, dias) | Previsao valorNota dias <- previsoesDe dia cartaoTestado]
        it "num cartão novo toda nota volta em 1 dia" $
            prazos (cartao 1 2.5 dia) `shouldBe` [(valorNota, 1) | valorNota <- [0 .. 5]]
        -- Os prazos têm que sair da mesma conta do responder: 6 * 2.36, 6 * 2.5 e 6 * 2.6, arredondados.
        it "na terceira repetição os prazos das notas 3, 4 e 5 são 14, 15 e 16 dias" $
            prazos (Cartao 1 1 "f" "v" 2.5 6 2 dia) `shouldBe` [(0, 1), (1, 1), (2, 1), (3, 14), (4, 15), (5, 16)]
        it "o JSON do cartão a revisar traz o cartão e as previsões" $
            toJSON (paraRevisar dia (cartao 7 2.5 dia)) `shouldSatisfy` \json -> case json of
                Object chaves -> KM.member "frente" chaves && KM.member "previsoes" chaves
                _             -> False

    describe "Stats" $ do
        let semNada = calcularEstatisticas dia [] []
        it "sem revisões a taxa de acerto é 0" $
            estatisticasTaxaAcerto semNada `shouldBe` 0
        it "sem cartões a previsão tem 7 dias zerados a partir de hoje" $
            estatisticasPrevisao semNada `shouldBe` [(addDays deslocamento dia, 0) | deslocamento <- [0 .. 6]]
        it "o cartão atrasado conta no primeiro dia da previsão" $
            take 1 (estatisticasPrevisao (calcularEstatisticas dia [cartao 1 2.5 (addDays (-3) dia)] []))
                `shouldBe` [(dia, 1)]
        it "para hoje conta os atrasados e os de hoje" $
            estatisticasParaHoje (calcularEstatisticas dia
                [cartao 1 2.5 (addDays (-3) dia), cartao 2 2.5 dia, cartao 3 2.5 (addDays 1 dia)] [])
                `shouldBe` 2
        -- Nota 2 não é acerto, e a taxa é dividida pelo número de revisões, não de cartões.
        it "notas 5, 4, 2 e 1 dão taxa de acerto 0.5" $
            estatisticasTaxaAcerto (calcularEstatisticas dia [] [(dia, valorNota) | valorNota <- [5, 4, 2, 1]]) `shouldBe` 0.5
        it "os difíceis são as 5 menores facilidades abaixo de 2.0 em ordem crescente" $
            map cartaoFacilidade (estatisticasDificeis (calcularEstatisticas dia
                [cartao idCartao facilidadeInicial dia | (idCartao, facilidadeInicial) <- zip [1 ..] [1.9, 1.3, 1.8, 2.0, 1.5, 1.4, 2.5, 1.7, 1.6]] []))
                `shouldBe` [1.3, 1.4, 1.5, 1.6, 1.7]
        it "difíceis com a mesma facilidade saem por id" $
            map cartaoId (estatisticasDificeis (calcularEstatisticas dia [cartao 9 1.5 dia, cartao 2 1.5 dia] []))
                `shouldBe` [2, 9]
        it "revisões por dia tem 30 itens de hoje-29 até hoje" $
            map fst (estatisticasRevisoesPorDia semNada) `shouldBe` [addDays deslocamento dia | deslocamento <- [-29 .. 0]]
        it "a revisão de hoje conta no último dia" $
            drop 29 (estatisticasRevisoesPorDia (calcularEstatisticas dia [] [(dia, 4), (dia, 1), (addDays (-1) dia, 3)]))
                `shouldBe` [(dia, 2)]

    describe "Resumo" $ do
        let resumo revisoes = calcularResumo dia revisoes []
        it "sem revisões a sequência é zero" $
            resumoSequencia (resumo []) `shouldBe` 0
        it "conta todas as revisões de hoje" $
            resumoRevisoesHoje (resumo [dia, dia, addDays (-1) dia]) `shouldBe` 2
        it "três dias seguidos terminando hoje dão sequência 3" $
            resumoSequencia (resumo [dia, addDays (-1) dia, addDays (-2) dia]) `shouldBe` 3
        -- Enquanto o dia não acaba, quem ainda não estudou hoje não perde a sequência.
        it "sem revisão hoje a sequência continua a partir de ontem" $
            resumoSequencia (resumo [addDays (-1) dia, addDays (-2) dia]) `shouldBe` 2
        it "um dia sem revisão interrompe a sequência" $
            resumoSequencia (resumo [dia, addDays (-2) dia, addDays (-3) dia]) `shouldBe` 1
        it "a última revisão anteontem não forma sequência" $
            resumoSequencia (resumo [addDays (-2) dia]) `shouldBe` 0
        it "várias revisões no mesmo dia contam um dia só" $
            resumoSequencia (resumo [dia, dia, dia]) `shouldBe` 1
        it "a atividade tem 14 dias de hoje-13 até hoje" $
            map fst (resumoAtividade (resumo [])) `shouldBe` [addDays deslocamento dia | deslocamento <- [-13 .. 0]]
        it "a atividade soma as revisões de cada dia" $
            drop 12 (resumoAtividade (resumo [dia, addDays (-1) dia, dia])) `shouldBe` [(addDays (-1) dia, 1), (dia, 2)]

    describe "Resumo, próximos dias" $ do
        let proximos = resumoProximos . calcularResumo dia []
            agendado deslocamento = Agendado (addDays deslocamento dia)
            doDia deslocamento = filter ((== addDays deslocamento dia) . proximoDia) . proximos
        it "os próximos vão de amanhã até hoje+14" $
            map proximoDia (proximos []) `shouldBe` [addDays deslocamento dia | deslocamento <- [1 .. 14]]
        -- O dia vazio aparece com zero, em vez de sumir da agenda.
        it "dia sem cartas tem quantidade zero e nenhum baralho" $
            map (\diaDaAgenda -> (proximoQuantidade diaDaAgenda, proximoBaralhos diaDaAgenda)) (doDia 3 [agendado 2 1 "Japonês" 4])
                `shouldBe` [(0, [])]
        it "a quantidade do dia soma todos os baralhos" $
            map proximoQuantidade (doDia 2 [agendado 2 1 "Japonês" 3, agendado 2 2 "Capitais" 5]) `shouldBe` [8]
        it "os baralhos do dia vêm do que tem mais cartas para o que tem menos" $
            map (map agendadoBaralho . proximoBaralhos) (doDia 2 [agendado 2 1 "Japonês" 3, agendado 2 2 "Capitais" 5, agendado 2 3 "Química" 1])
                `shouldBe` [["Capitais", "Japonês", "Química"]]
        it "empate na quantidade fica em ordem de nome" $
            map (map agendadoBaralho . proximoBaralhos) (doDia 5 [agendado 5 1 "Química" 2, agendado 5 2 "Anatomia" 2])
                `shouldBe` [["Anatomia", "Química"]]
        it "ignora cartas de hoje, atrasadas e depois de hoje+14" $
            sum (map proximoQuantidade (proximos [agendado 0 1 "A" 2, agendado (-3) 1 "A" 4, agendado 15 1 "A" 7]))
                `shouldBe` 0
        it "o JSON de um dia usa as chaves do contrato" $
            toJSON (Proximo (addDays 1 dia) 3 [Agendado (addDays 1 dia) 7 "Japonês" 3]) `shouldBe` object
                [ "dia" .= addDays 1 dia, "quantidade" .= (3 :: Int)
                , "baralhos" .= [object ["id" .= (7 :: Int), "nome" .= ("Japonês" :: String), "quantidade" .= (3 :: Int)]] ]

    describe "Conta" $ do
        let conta = NovaConta "Ana" "ana@exemplo.com" "Segredo#123"
        it "recusa nome em branco" $
            validarNovaConta conta { contaNome = "  " } `shouldBe` Left "informe seu nome"
        it "recusa nome com mais de 80 caracteres" $
            validarNovaConta conta { contaNome = T.replicate 81 "a" } `shouldBe` Left "o nome deve ter no máximo 80 caracteres"
        it "tira os espaços das pontas do nome" $
            fmap contaNome (validarNovaConta conta { contaNome = "  Ana Lima " }) `shouldBe` Right "Ana Lima"
        -- Sem normalizar, a mesma pessoa poderia criar duas contas mudando só maiúsculas ou espaços.
        it "normaliza o e-mail para minúsculas e sem espaços nas pontas" $
            fmap contaEmail (validarNovaConta conta { contaEmail = "  Ana@Exemplo.COM " }) `shouldBe` Right "ana@exemplo.com"
        it "recusa e-mail sem arroba" $
            validarNovaConta conta { contaEmail = "ana.exemplo.com" } `shouldBe` Left "e-mail inválido"
        it "recusa e-mail com duas arrobas" $
            validarNovaConta conta { contaEmail = "ana@x@exemplo.com" } `shouldBe` Left "e-mail inválido"
        it "recusa domínio sem ponto" $
            validarNovaConta conta { contaEmail = "ana@localhost" } `shouldBe` Left "e-mail inválido"
        it "recusa e-mail com espaço interno" $
            validarNovaConta conta { contaEmail = "ana maria@exemplo.com" } `shouldBe` Left "e-mail inválido"
        it "recusa e-mail sem usuário" $
            validarNovaConta conta { contaEmail = "@exemplo.com" } `shouldBe` Left "e-mail inválido"
        it "recusa senha com 7 caracteres" $
            validarNovaConta conta { contaSenha = "Ab#1234" } `shouldBe` Left "a senha deve ter pelo menos 8 caracteres"
        -- Se a senha passasse por strip, deixaria de ser exatamente a que a pessoa digitou.
        it "preserva os espaços da senha" $
            fmap contaSenha (validarNovaConta conta { contaSenha = "  Segr#d0  " }) `shouldBe` Right "  Segr#d0  "
        -- O bcrypt usa no máximo 72 bytes da senha, então 72 ainda tem que ser aceito.
        it "aceita senha de 72 bytes" $
            fmap contaSenha (validarNovaConta conta { contaSenha = "Aa#1" <> T.replicate 68 "a" }) `shouldBe` Right ("Aa#1" <> T.replicate 68 "a")
        -- O limite é em bytes, não em caracteres: "é" ocupa 2 bytes em UTF-8, então esta senha tem 39 caracteres e 74 bytes.
        it "recusa senha acima de 72 bytes mesmo com menos de 72 caracteres" $
            validarNovaConta conta { contaSenha = "Aa#1" <> T.replicate 35 "é" } `shouldBe` Left "a senha é longa demais"
        it "recusa senha sem letra maiúscula" $
            validarNovaConta conta { contaSenha = "segredo#123" } `shouldBe` Left "a senha precisa de uma letra maiúscula"
        it "recusa senha sem letra minúscula" $
            validarNovaConta conta { contaSenha = "SEGREDO#123" } `shouldBe` Left "a senha precisa de uma letra minúscula"
        it "recusa senha sem número" $
            validarNovaConta conta { contaSenha = "Segredo#abc" } `shouldBe` Left "a senha precisa de um número"
        it "recusa senha sem símbolo" $
            validarNovaConta conta { contaSenha = "Segredo1234" } `shouldBe` Left "a senha precisa de um símbolo"
        it "o espaço não conta como símbolo" $
            validarNovaConta conta { contaSenha = "Segredo 123" } `shouldBe` Left "a senha precisa de um símbolo"
        it "letra acentuada conta como letra" $
            fmap contaSenha (validarNovaConta conta { contaSenha = "Água#1234" }) `shouldBe` Right "Água#1234"
        -- No login a senha só é comparada com o hash. As regras de força valem apenas no cadastro.
        it "o login aceita senha fora da regra do cadastro" $
            validarCredenciais (Credenciais "ana@exemplo.com" "abc") `shouldBe` Right (Credenciais "ana@exemplo.com" "abc")
        it "o login normaliza o e-mail" $
            validarCredenciais (Credenciais " Ana@Exemplo.com " "x") `shouldBe` Right (Credenciais "ana@exemplo.com" "x")
        it "o login recusa senha vazia" $
            validarCredenciais (Credenciais "ana@exemplo.com" "") `shouldBe` Left "informe e-mail e senha"
        it "o login recusa e-mail em branco" $
            validarCredenciais (Credenciais "  " "segredo123") `shouldBe` Left "informe e-mail e senha"
        -- O hash da senha nunca pode aparecer no JSON do usuário.
        it "o JSON do usuário tem só id, nome e e-mail" $
            toJSON (Usuario 7 "Ana" "ana@exemplo.com") `shouldBe` object
                [ "id" .= (7 :: Int), "nome" .= ("Ana" :: String), "email" .= ("ana@exemplo.com" :: String) ]
        it "o corpo de cadastro sem senha é recusado com a mensagem da validação" $
            (eitherDecode "{\"nome\":\"Ana\",\"email\":\"ana@exemplo.com\"}" :: Either String NovaConta)
                `shouldSatisfy` either ("a senha deve ter pelo menos 8 caracteres" `isSuffixOf`) (const False)
        it "o corpo de login sem e-mail é recusado com a mensagem da validação" $
            (eitherDecode "{\"senha\":\"x\"}" :: Either String Credenciais)
                `shouldSatisfy` either ("informe e-mail e senha" `isSuffixOf`) (const False)
