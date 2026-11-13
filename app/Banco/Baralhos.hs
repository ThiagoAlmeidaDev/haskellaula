{-# LANGUAGE OverloadedStrings #-}

{- | Consultas de baralhos, cartões e revisões. Toda busca que parte de um id vindo do cliente
filtra pelo dono da conta, então o baralho de outra pessoa é indistinguível de um inexistente.
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

{- | Cor e padrão chegam como texto; o CHECK do schema só deixa gravar os valores conhecidos, então
um texto que não se lê é banco fora do schema, e a consulta falha em vez de inventar uma capa.
-}
paraBaralho :: LinhaBaralho -> IO Baralho
paraBaralho (i, n, d, total, hoje, c, p) = Baralho i n d total hoje semEtapas <$> lerVisual c p

lerVisual :: Text -> Text -> IO Visual
lerVisual c p = case (lerCor c, lerPadrao p) of
    (Just cor', Just padrao') -> pure (Visual cor' padrao')
    _ -> throwIO (userError ("capa de baralho fora do schema: " ++ show (c, p)))

{- | As etapas saem de etapaDe, em Haskell, a partir de (baralho, repetições, intervalo) de
cada cartão: a regra de novo, aprendendo e dominado não se repete no SQL.
-}
comEtapas :: [(Int, Int, Int)] -> [Baralho] -> [Baralho]
comEtapas linhas = map (\b -> b { etapas = Map.findWithDefault semEtapas (baralhoId b) porBaralho })
  where
    porBaralho = Map.map contarEtapas (Map.fromListWith (++) [(bid, [(r, i)]) | (bid, r, i) <- linhas])

paraCartao :: LinhaCartao -> Cartao
paraCartao (i, b, f, v, fac, int, rep, prox) = Cartao i b f v fac int rep prox

colunasCartao :: Query
colunasCartao = "id, baralho_id, frente, verso, facilidade, intervalo, repeticoes, proxima_revisao"

-- As mesmas colunas, prefixadas, para consultas que juntam cartoes c com baralhos b.
colunasCartaoC :: Query
colunasCartaoC = "c.id, c.baralho_id, c.frente, c.verso, c.facilidade, c.intervalo, c.repeticoes, c.proxima_revisao"

consultaBaralhos :: Query
consultaBaralhos =
    "SELECT b.id, b.nome, b.descricao, count(c.id)::int, \
    \count(c.id) FILTER (WHERE c.proxima_revisao <= ?)::int, b.cor, b.padrao \
    \FROM baralhos b LEFT JOIN cartoes c ON c.baralho_id = b.id "

-- Um INSERT ou UPDATE com RETURNING que não devolve uma linha só é falha do banco, não ausência.
umaLinha :: String -> [a] -> IO a
umaLinha _ [x]  = pure x
umaLinha oque _ = throwIO (userError (oque ++ ": o banco não devolveu exatamente uma linha"))

listarBaralhos :: Connection -> Int -> Day -> IO [Baralho]
listarBaralhos conn uid hoje = do
    lista <- mapM paraBaralho =<< query conn (consultaBaralhos <> "WHERE b.usuario_id = ? GROUP BY b.id ORDER BY b.id") (hoje, uid)
    linhas <- query conn
        "SELECT c.baralho_id, c.repeticoes, c.intervalo FROM cartoes c JOIN baralhos b ON b.id = c.baralho_id \
        \WHERE b.usuario_id = ?"
        (Only uid)
    pure (comEtapas linhas lista)

buscarBaralho :: Connection -> Int -> Day -> Int -> IO (Maybe Baralho)
buscarBaralho conn uid hoje bid = do
    linhas <- query conn (consultaBaralhos <> "WHERE b.id = ? AND b.usuario_id = ? GROUP BY b.id") (hoje, bid, uid)
    case linhas of
        [linha] -> do
            estados <- query conn "SELECT baralho_id, repeticoes, intervalo FROM cartoes WHERE baralho_id = ?" (Only bid)
            base <- paraBaralho linha
            pure (case comEtapas estados [base] of
                [b] -> Just b
                _   -> Nothing)
        _ -> pure Nothing

criarBaralho :: Connection -> Int -> NovoBaralho -> IO Baralho
criarBaralho conn uid (NovoBaralho n d v) = do
    linhas <- query conn
        "INSERT INTO baralhos (usuario_id, nome, descricao, cor, padrao) VALUES (?, ?, ?, ?, ?) \
        \RETURNING id, nome, descricao, cor, padrao"
        (uid, n, d, corTexto (cor v), padraoTexto (padrao v))
    (i, n', d', c, p) <- umaLinha "criarBaralho" linhas
    Baralho i n' d' 0 0 semEtapas <$> lerVisual c p

-- Nothing quando o baralho não existe ou é de outra conta; as contagens saem do buscarBaralho.
editarBaralho :: Connection -> Int -> Day -> Int -> NovoBaralho -> IO (Maybe Baralho)
editarBaralho conn uid hoje bid (NovoBaralho n d v) = do
    alterados <- execute conn
        "UPDATE baralhos SET nome = ?, descricao = ?, cor = ?, padrao = ? WHERE id = ? AND usuario_id = ?"
        (n, d, corTexto (cor v), padraoTexto (padrao v), bid, uid)
    if alterados == 0 then pure Nothing else buscarBaralho conn uid hoje bid

excluirBaralho :: Connection -> Int -> Int -> IO Bool
excluirBaralho conn uid bid = (> 0) <$> execute conn "DELETE FROM baralhos WHERE id = ? AND usuario_id = ?" (bid, uid)

-- O baralho chega aqui já conferido como da conta; o filtro é só pelo id dele.
listarCartoes :: Connection -> Int -> IO [Cartao]
listarCartoes conn bid =
    map paraCartao <$> query conn ("SELECT " <> colunasCartao <> " FROM cartoes WHERE baralho_id = ? ORDER BY id") (Only bid)

buscarCartao :: Connection -> Int -> Int -> IO (Maybe Cartao)
buscarCartao conn uid cid = do
    linhas <- query conn
        ("SELECT " <> colunasCartaoC <> " FROM cartoes c JOIN baralhos b ON b.id = c.baralho_id \
         \WHERE c.id = ? AND b.usuario_id = ?")
        (cid, uid)
    pure (case linhas of
        [linha] -> Just (paraCartao linha)
        _       -> Nothing)

criarCartao :: Connection -> Int -> Day -> NovoCartao -> IO Cartao
criarCartao conn bid hoje (NovoCartao f v) = do
    let e = estadoInicial hoje
    linhas <- query conn
        ("INSERT INTO cartoes (baralho_id, frente, verso, facilidade, intervalo, repeticoes, proxima_revisao) \
         \VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING " <> colunasCartao)
        (bid, f, v, facilidade e, intervalo e, repeticoes e, proximaRevisao e)
    paraCartao <$> umaLinha "criarCartao" linhas

editarCartao :: Connection -> Int -> Int -> NovoCartao -> IO (Maybe Cartao)
editarCartao conn uid cid (NovoCartao f v) = do
    linhas <- query conn
        ("UPDATE cartoes c SET frente = ?, verso = ? FROM baralhos b \
         \WHERE c.id = ? AND b.id = c.baralho_id AND b.usuario_id = ? RETURNING " <> colunasCartaoC)
        (f, v, cid, uid)
    pure (case linhas of
        [linha] -> Just (paraCartao linha)
        _       -> Nothing)

excluirCartao :: Connection -> Int -> Int -> IO Bool
excluirCartao conn uid cid = (> 0) <$> execute conn
    "DELETE FROM cartoes c USING baralhos b WHERE c.id = ? AND b.id = c.baralho_id AND b.usuario_id = ?"
    (cid, uid)

cartoesParaRevisar :: Connection -> Int -> Day -> IO [Cartao]
cartoesParaRevisar conn bid hoje =
    map paraCartao <$> query conn
        ("SELECT " <> colunasCartao <> " FROM cartoes WHERE baralho_id = ? AND proxima_revisao <= ? \
         \ORDER BY proxima_revisao, id")
        (bid, hoje)

-- Os devidos de todos os baralhos da conta, na mesma ordem do revisar de um baralho só.
cartoesParaRevisarDaConta :: Connection -> Int -> Day -> IO [Cartao]
cartoesParaRevisarDaConta conn uid hoje =
    map paraCartao <$> query conn
        ("SELECT " <> colunasCartaoC <> " FROM cartoes c JOIN baralhos b ON b.id = c.baralho_id \
         \WHERE b.usuario_id = ? AND c.proxima_revisao <= ? ORDER BY c.proxima_revisao, c.baralho_id, c.id")
        (uid, hoje)

{- | Grava o novo estado e a revisão num único comando, então os dois ficam ou nenhum fica,
sem BEGIN na conexão que todas as requisições compartilham. O UPDATE só acontece se o cartão
ainda está no estado lido antes do SM-2; Nothing quer dizer que ele mudou ou sumiu no meio.
-}
registrarResposta :: Connection -> Cartao -> Nota -> EstadoCartao -> IO (Maybe Cartao)
registrarResposta conn anterior nota e = do
    linhas <- query conn
        ("WITH atualizado AS (\
         \UPDATE cartoes SET facilidade = ?, intervalo = ?, repeticoes = ?, proxima_revisao = ? \
         \WHERE id = ? AND facilidade = ? AND intervalo = ? AND repeticoes = ? AND proxima_revisao = ? \
         \RETURNING " <> colunasCartao <> "), \
         \revisao AS (INSERT INTO revisoes (cartao_id, nota) SELECT id, ? FROM atualizado) \
         \SELECT " <> colunasCartao <> " FROM atualizado")
        ( (facilidade e, intervalo e, repeticoes e, proximaRevisao e, cartaoId anterior)
        :. (cFacilidade anterior, cIntervalo anterior, cRepeticoes anterior, cProximaRevisao anterior)
        :. Only (notaValor nota) )
    pure (case linhas of
        [linha] -> Just (paraCartao linha)
        _       -> Nothing)

-- O dia local de cada revisão sai em Haskell com o fuso do servidor; o banco roda em UTC.
notasDoBaralho :: Connection -> TimeZone -> Int -> IO [(Day, Int)]
notasDoBaralho conn tz bid = do
    linhas <- query conn
        "SELECT r.revisado_em, r.nota FROM revisoes r JOIN cartoes c ON c.id = r.cartao_id WHERE c.baralho_id = ?"
        (Only bid)
    pure [(localDay (utcToLocalTime tz t), n) | (t, n) <- (linhas :: [(UTCTime, Int)])]

-- Mesma conversão de fuso de notasDoBaralho, para todas as revisões da conta.
diasDeRevisao :: Connection -> TimeZone -> Int -> IO [Day]
diasDeRevisao conn tz uid = do
    linhas <- query conn
        "SELECT r.revisado_em FROM revisoes r JOIN cartoes c ON c.id = r.cartao_id \
        \JOIN baralhos b ON b.id = c.baralho_id WHERE b.usuario_id = ?"
        (Only uid)
    pure [localDay (utcToLocalTime tz t) | Only t <- (linhas :: [Only UTCTime])]

-- Cartões da conta agendados depois de hoje, contados por dia e baralho; a janela é do Nucleo.Stats.
agendaDaConta :: Connection -> Int -> Day -> IO [Agendado]
agendaDaConta conn uid hoje = do
    linhas <- query conn
        "SELECT c.proxima_revisao, b.id, b.nome, count(*) FROM cartoes c \
        \JOIN baralhos b ON b.id = c.baralho_id \
        \WHERE b.usuario_id = ? AND c.proxima_revisao > ? \
        \GROUP BY c.proxima_revisao, b.id, b.nome ORDER BY c.proxima_revisao, b.id"
        (uid, hoje)
    pure [Agendado d bid nomeBaralho n | (d, bid, nomeBaralho, n) <- linhas]
