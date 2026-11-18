{-# LANGUAGE OverloadedStrings #-}

{- | Consultas de baralhos, cartões e revisões. Toda busca a partir de um id que veio do cliente
também filtra pelo dono da conta, então o baralho de outra pessoa se comporta igual a um baralho
que não existe.
-}
module Banco.Baralhos
    ( listarBaralhos
    , buscarBaralho
    , criarBaralho
    , editarBaralho
    , excluirBaralho
    , listarCartoes
    , buscarCartao
    , criarCartao
    , editarCartao
    , excluirCartao
    , cartoesParaRevisar
    , cartoesParaRevisarDaConta
    , registrarResposta
    , notasDoBaralho
    , diasDeRevisao
    , agendaDaConta
    ) where

import Control.Exception (throwIO)
import qualified Data.Map.Strict as Map
import Data.Text (Text)
import Data.Time (Day, TimeZone, UTCTime, localDay, utcToLocalTime)
import Database.PostgreSQL.Simple

import Nucleo.SM2 (EstadoCartao (..), Nota, estadoInicial, notaValor)
import Nucleo.Stats (Agendado (..))
import Nucleo.Types

type LinhaBaralho = (Int, Text, Text, Int, Int, Text, Text)

type LinhaCartao = (Int, Int, Text, Text, Double, Int, Int, Day)

{- | A cor e o padrão chegam do banco como texto. O CHECK do schema só deixa gravar valores
conhecidos, então um texto que não dá para ler quer dizer que o banco está fora do schema. Nesse
caso a consulta falha, em vez de inventar uma capa.
-}
paraBaralho :: LinhaBaralho -> IO Baralho
paraBaralho (idBaralho, nomeBaralho, descricaoBaralho, total, vencemHoje, textoCor, textoPadrao) =
    Baralho idBaralho nomeBaralho descricaoBaralho total vencemHoje semEtapas <$> lerVisual textoCor textoPadrao

lerVisual :: Text -> Text -> IO Visual
lerVisual textoCor textoPadrao = case (lerCor textoCor, lerPadrao textoPadrao) of
    (Just corLida, Just padraoLido) -> pure (Visual corLida padraoLido)
    _ -> throwIO (userError ("capa de baralho fora do schema: " ++ show (textoCor, textoPadrao)))

{- | As etapas são calculadas em Haskell, com etapaDe, a partir de (baralho, repetições, intervalo)
de cada cartão. Assim a regra de novo, aprendendo e dominado fica num lugar só e não é repetida
no SQL.
-}
comEtapas :: [(Int, Int, Int)] -> [Baralho] -> [Baralho]
comEtapas linhas = map (\baralho -> baralho { etapas = Map.findWithDefault semEtapas (baralhoId baralho) porBaralho })
  where
    porBaralho = Map.map contarEtapas
        (Map.fromListWith (++) [(idBaralho, [(numeroRepeticoes, diasIntervalo)]) | (idBaralho, numeroRepeticoes, diasIntervalo) <- linhas])

paraCartao :: LinhaCartao -> Cartao
paraCartao (idCartao, idBaralho, textoFrente, textoVerso, facilidadeAtual, intervaloAtual, repeticoesAtuais, proxima) =
    Cartao idCartao idBaralho textoFrente textoVerso facilidadeAtual intervaloAtual repeticoesAtuais proxima

colunasCartao :: Query
colunasCartao = "id, baralho_id, frente, verso, facilidade, intervalo, repeticoes, proxima_revisao"

-- As mesmas colunas com o prefixo "c.", para as consultas que juntam cartoes c com baralhos b.
colunasCartaoC :: Query
colunasCartaoC = "c.id, c.baralho_id, c.frente, c.verso, c.facilidade, c.intervalo, c.repeticoes, c.proxima_revisao"

consultaBaralhos :: Query
consultaBaralhos =
    "SELECT b.id, b.nome, b.descricao, count(c.id)::int, \
    \count(c.id) FILTER (WHERE c.proxima_revisao <= ?)::int, b.cor, b.padrao \
    \FROM baralhos b LEFT JOIN cartoes c ON c.baralho_id = b.id "

-- Um INSERT ou UPDATE com RETURNING que não devolve exatamente uma linha é uma falha do banco.
umaLinha :: String -> [a] -> IO a
umaLinha _ [linha]  = pure linha
umaLinha operacao _ = throwIO (userError (operacao ++ ": o banco não devolveu exatamente uma linha"))

listarBaralhos :: Connection -> Int -> Day -> IO [Baralho]
listarBaralhos conn idUsuario hoje = do
    lista <- mapM paraBaralho =<< query conn (consultaBaralhos <> "WHERE b.usuario_id = ? GROUP BY b.id ORDER BY b.id") (hoje, idUsuario)
    linhas <- query conn
        "SELECT c.baralho_id, c.repeticoes, c.intervalo FROM cartoes c JOIN baralhos b ON b.id = c.baralho_id \
        \WHERE b.usuario_id = ?"
        (Only idUsuario)
    pure (comEtapas linhas lista)

buscarBaralho :: Connection -> Int -> Day -> Int -> IO (Maybe Baralho)
buscarBaralho conn idUsuario hoje idBaralho = do
    linhas <- query conn (consultaBaralhos <> "WHERE b.id = ? AND b.usuario_id = ? GROUP BY b.id") (hoje, idBaralho, idUsuario)
    case linhas of
        [linha] -> do
            estados <- query conn "SELECT baralho_id, repeticoes, intervalo FROM cartoes WHERE baralho_id = ?" (Only idBaralho)
            base <- paraBaralho linha
            pure (case comEtapas estados [base] of
                [baralho] -> Just baralho
                _         -> Nothing)
        _ -> pure Nothing

criarBaralho :: Connection -> Int -> NovoBaralho -> IO Baralho
criarBaralho conn idUsuario (NovoBaralho nomeBaralho descricaoBaralho visualBaralho) = do
    linhas <- query conn
        "INSERT INTO baralhos (usuario_id, nome, descricao, cor, padrao) VALUES (?, ?, ?, ?, ?) \
        \RETURNING id, nome, descricao, cor, padrao"
        (idUsuario, nomeBaralho, descricaoBaralho, corTexto (cor visualBaralho), padraoTexto (padrao visualBaralho))
    (idCriado, nomeSalvo, descricaoSalva, textoCor, textoPadrao) <- umaLinha "criarBaralho" linhas
    Baralho idCriado nomeSalvo descricaoSalva 0 0 semEtapas <$> lerVisual textoCor textoPadrao

-- Devolve Nothing quando o baralho não existe ou é de outra conta. As contagens vêm do buscarBaralho.
editarBaralho :: Connection -> Int -> Day -> Int -> NovoBaralho -> IO (Maybe Baralho)
editarBaralho conn idUsuario hoje idBaralho (NovoBaralho nomeBaralho descricaoBaralho visualBaralho) = do
    alterados <- execute conn
        "UPDATE baralhos SET nome = ?, descricao = ?, cor = ?, padrao = ? WHERE id = ? AND usuario_id = ?"
        (nomeBaralho, descricaoBaralho, corTexto (cor visualBaralho), padraoTexto (padrao visualBaralho), idBaralho, idUsuario)
    if alterados == 0 then pure Nothing else buscarBaralho conn idUsuario hoje idBaralho

excluirBaralho :: Connection -> Int -> Int -> IO Bool
excluirBaralho conn idUsuario idBaralho =
    (> 0) <$> execute conn "DELETE FROM baralhos WHERE id = ? AND usuario_id = ?" (idBaralho, idUsuario)

-- Quem chama já conferiu que o baralho é da conta, então aqui o filtro é só pelo id do baralho.
listarCartoes :: Connection -> Int -> IO [Cartao]
listarCartoes conn idBaralho =
    map paraCartao <$> query conn ("SELECT " <> colunasCartao <> " FROM cartoes WHERE baralho_id = ? ORDER BY id") (Only idBaralho)

buscarCartao :: Connection -> Int -> Int -> IO (Maybe Cartao)
buscarCartao conn idUsuario idCartao = do
    linhas <- query conn
        ("SELECT " <> colunasCartaoC <> " FROM cartoes c JOIN baralhos b ON b.id = c.baralho_id \
         \WHERE c.id = ? AND b.usuario_id = ?")
        (idCartao, idUsuario)
    pure (case linhas of
        [linha] -> Just (paraCartao linha)
        _       -> Nothing)

criarCartao :: Connection -> Int -> Day -> NovoCartao -> IO Cartao
criarCartao conn idBaralho hoje (NovoCartao textoFrente textoVerso) = do
    let estado = estadoInicial hoje
    linhas <- query conn
        ("INSERT INTO cartoes (baralho_id, frente, verso, facilidade, intervalo, repeticoes, proxima_revisao) \
         \VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING " <> colunasCartao)
        (idBaralho, textoFrente, textoVerso, facilidade estado, intervalo estado, repeticoes estado, proximaRevisao estado)
    paraCartao <$> umaLinha "criarCartao" linhas

editarCartao :: Connection -> Int -> Int -> NovoCartao -> IO (Maybe Cartao)
editarCartao conn idUsuario idCartao (NovoCartao textoFrente textoVerso) = do
    linhas <- query conn
        ("UPDATE cartoes c SET frente = ?, verso = ? FROM baralhos b \
         \WHERE c.id = ? AND b.id = c.baralho_id AND b.usuario_id = ? RETURNING " <> colunasCartaoC)
        (textoFrente, textoVerso, idCartao, idUsuario)
    pure (case linhas of
        [linha] -> Just (paraCartao linha)
        _       -> Nothing)

excluirCartao :: Connection -> Int -> Int -> IO Bool
excluirCartao conn idUsuario idCartao = (> 0) <$> execute conn
    "DELETE FROM cartoes c USING baralhos b WHERE c.id = ? AND b.id = c.baralho_id AND b.usuario_id = ?"
    (idCartao, idUsuario)

cartoesParaRevisar :: Connection -> Int -> Day -> IO [Cartao]
cartoesParaRevisar conn idBaralho hoje =
    map paraCartao <$> query conn
        ("SELECT " <> colunasCartao <> " FROM cartoes WHERE baralho_id = ? AND proxima_revisao <= ? \
         \ORDER BY proxima_revisao, id")
        (idBaralho, hoje)

-- Os cartões que vencem até hoje em todos os baralhos da conta, na mesma ordem de cartoesParaRevisar.
cartoesParaRevisarDaConta :: Connection -> Int -> Day -> IO [Cartao]
cartoesParaRevisarDaConta conn idUsuario hoje =
    map paraCartao <$> query conn
        ("SELECT " <> colunasCartaoC <> " FROM cartoes c JOIN baralhos b ON b.id = c.baralho_id \
         \WHERE b.usuario_id = ? AND c.proxima_revisao <= ? ORDER BY c.proxima_revisao, c.baralho_id, c.id")
        (idUsuario, hoje)

{- | Grava o novo estado do cartão e a revisão num único comando, para que ou os dois sejam
gravados ou nenhum seja, sem precisar de BEGIN na conexão compartilhada pelas requisições.

O UPDATE só acontece se o cartão ainda estiver no mesmo estado que foi lido antes de aplicar o
SM-2. Se a função devolver Nothing, o cartão foi alterado ou apagado nesse meio tempo (por
exemplo, respondido em outra aba).
-}
registrarResposta :: Connection -> Cartao -> Nota -> EstadoCartao -> IO (Maybe Cartao)
registrarResposta conn anterior nota novoEstado = do
    linhas <- query conn
        ("WITH atualizado AS (\
         \UPDATE cartoes SET facilidade = ?, intervalo = ?, repeticoes = ?, proxima_revisao = ? \
         \WHERE id = ? AND facilidade = ? AND intervalo = ? AND repeticoes = ? AND proxima_revisao = ? \
         \RETURNING " <> colunasCartao <> "), \
         \revisao AS (INSERT INTO revisoes (cartao_id, nota) SELECT id, ? FROM atualizado) \
         \SELECT " <> colunasCartao <> " FROM atualizado")
        ( (facilidade novoEstado, intervalo novoEstado, repeticoes novoEstado, proximaRevisao novoEstado, cartaoId anterior)
        :. (cartaoFacilidade anterior, cartaoIntervalo anterior, cartaoRepeticoes anterior, cartaoProximaRevisao anterior)
        :. Only (notaValor nota) )
    pure (case linhas of
        [linha] -> Just (paraCartao linha)
        _       -> Nothing)

-- O banco guarda o horário em UTC. O dia local de cada revisão é calculado aqui, com o fuso do servidor.
notasDoBaralho :: Connection -> TimeZone -> Int -> IO [(Day, Int)]
notasDoBaralho conn tz idBaralho = do
    linhas <- query conn
        "SELECT r.revisado_em, r.nota FROM revisoes r JOIN cartoes c ON c.id = r.cartao_id WHERE c.baralho_id = ?"
        (Only idBaralho)
    pure [(localDay (utcToLocalTime tz revisadoEm), notaDada) | (revisadoEm, notaDada) <- (linhas :: [(UTCTime, Int)])]

-- A mesma conversão de fuso de notasDoBaralho, para todas as revisões da conta.
diasDeRevisao :: Connection -> TimeZone -> Int -> IO [Day]
diasDeRevisao conn tz idUsuario = do
    linhas <- query conn
        "SELECT r.revisado_em FROM revisoes r JOIN cartoes c ON c.id = r.cartao_id \
        \JOIN baralhos b ON b.id = c.baralho_id WHERE b.usuario_id = ?"
        (Only idUsuario)
    pure [localDay (utcToLocalTime tz revisadoEm) | Only revisadoEm <- (linhas :: [Only UTCTime])]

-- Cartões da conta agendados depois de hoje, contados por dia e por baralho. O Nucleo.Stats decide a janela de dias.
agendaDaConta :: Connection -> Int -> Day -> IO [Agendado]
agendaDaConta conn idUsuario hoje = do
    linhas <- query conn
        "SELECT c.proxima_revisao, b.id, b.nome, count(*) FROM cartoes c \
        \JOIN baralhos b ON b.id = c.baralho_id \
        \WHERE b.usuario_id = ? AND c.proxima_revisao > ? \
        \GROUP BY c.proxima_revisao, b.id, b.nome ORDER BY c.proxima_revisao, b.id"
        (idUsuario, hoje)
    pure [Agendado dia idBaralho nomeBaralho quantidade | (dia, idBaralho, nomeBaralho, quantidade) <- linhas]
