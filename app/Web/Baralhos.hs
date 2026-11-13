{-# LANGUAGE OverloadedStrings #-}

{- | Handlers das rotas da conta: resumo, baralhos, cartões, revisão e estatísticas. A ordem em
cada um é autenticar (401), validar o corpo (400), buscar o que precisa existir (404), aplicar a
regra pura e persistir. O id de outra conta responde 404, igual a um id inexistente.
-}
module Web.Baralhos
    ( rotasDaConta
    ) where

import Control.Monad.IO.Class (liftIO)
import Data.Pool (Pool)
import Data.Text (Text)
import Data.Time (getCurrentTimeZone)
import Database.PostgreSQL.Simple (Connection)
import Servant

import Banco.Baralhos
import Banco.Preferencias (buscarPreferencias, salvarPreferencias)
import Nucleo.Conta (Usuario (..))
import Nucleo.SM2 (responder)
import Nucleo.Stats (calcularEstatisticas, calcularResumo)
import Nucleo.Types
import Web.Api (RotasDaConta)
import Web.Comum (banco, encontrado, excluido, falhar, hoje, validar)

semBaralho, semCartao :: Text
semBaralho = "baralho não encontrado"
semCartao  = "cartão não encontrado"

-- A conta vem como ação: cada handler a roda primeiro, e sem sessão nada mais acontece.
rotasDaConta :: Pool Connection -> Handler Usuario -> Server RotasDaConta
rotasDaConta pool conta =
         resumo
    :<|> preferencias
    :<|> salvarPrefs
    :<|> listar
    :<|> criar
    :<|> buscar
    :<|> editarB
    :<|> excluir
    :<|> cartoes
    :<|> novoCartao
    :<|> revisar
    :<|> revisarTudo
    :<|> estatisticas
    :<|> editar
    :<|> excluirC
    :<|> responderCartao
  where
    uid = usuarioId <$> conta

    resumo = do
        u <- uid
        banco pool $ \conn -> do
            d <- hoje
            tz <- getCurrentTimeZone
            calcularResumo d <$> diasDeRevisao conn tz u <*> agendaDaConta conn u d

    preferencias = uid >>= \u -> banco pool (\conn -> buscarPreferencias conn u)

    -- O FromJSON de Preferencias já recusou valor fora da escala com 400 antes de chegar aqui.
    salvarPrefs prefs = uid >>= \u -> banco pool (\conn -> salvarPreferencias conn u prefs)

    listar = do
        u <- uid
        banco pool (\conn -> hoje >>= listarBaralhos conn u)

    criar dados = do
        u <- uid
        nb <- validar (validarNovoBaralho dados)
        banco pool (\conn -> criarBaralho conn u nb)

    buscarDa u bid = banco pool (\conn -> hoje >>= \d -> buscarBaralho conn u d bid) >>= encontrado semBaralho

    buscar bid = uid >>= \u -> buscarDa u bid

    editarB bid dados = do
        u <- uid
        nb <- validar (validarNovoBaralho dados)
        banco pool (\conn -> hoje >>= \d -> editarBaralho conn u d bid nb) >>= encontrado semBaralho

    excluir bid = do
        u <- uid
        banco pool (\conn -> excluirBaralho conn u bid) >>= excluido semBaralho

    -- As rotas por baralho conferem o dono aqui; as consultas seguintes filtram só pelo id.
    exigirBaralho bid = uid >>= \u -> buscarDa u bid >> pure ()

    cartoes bid = do
        exigirBaralho bid
        banco pool (\conn -> listarCartoes conn bid)

    novoCartao bid dados = do
        u <- uid
        nc <- validar (validarNovoCartao dados)
        _ <- buscarDa u bid
        banco pool (\conn -> hoje >>= \d -> criarCartao conn bid d nc)

    editar cid dados = do
        u <- uid
        nc <- validar (validarNovoCartao dados)
        banco pool (\conn -> editarCartao conn u cid nc) >>= encontrado semCartao

    excluirC cid = do
        u <- uid
        banco pool (\conn -> excluirCartao conn u cid) >>= excluido semCartao

    revisar bid = do
        exigirBaralho bid
        banco pool $ \conn -> do
            d <- hoje
            map (paraRevisar d) <$> cartoesParaRevisar conn bid d

    revisarTudo = do
        u <- uid
        banco pool $ \conn -> do
            d <- hoje
            map (paraRevisar d) <$> cartoesParaRevisarDaConta conn u d

    estatisticas bid = do
        exigirBaralho bid
        banco pool $ \conn -> do
            d <- hoje
            tz <- getCurrentTimeZone
            calcularEstatisticas d <$> listarCartoes conn bid <*> notasDoBaralho conn tz bid

    -- A nota é validada antes de qualquer consulta ao cartão: nota inválida nunca toca o banco.
    responderCartao cid dados = do
        u <- uid
        nota <- validar (validarResposta dados)
        c <- banco pool (\conn -> buscarCartao conn u cid) >>= encontrado semCartao
        d <- liftIO hoje
        gravado <- banco pool (\conn -> registrarResposta conn c nota (responder nota d (estadoDoCartao c)))
        case gravado of
            Just novo -> pure novo
            Nothing   -> banco pool (\conn -> buscarCartao conn u cid)
                >>= encontrado semCartao
                >>= \_ -> falhar err409 "o cartão já foi respondido em outra sessão"
