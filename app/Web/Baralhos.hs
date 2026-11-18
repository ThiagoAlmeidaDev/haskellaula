{-# LANGUAGE OverloadedStrings #-}

{- | Handlers das rotas da conta: resumo, baralhos, cartões, revisão e estatísticas. Todos seguem a
mesma ordem: autenticar (401), validar o corpo (400), buscar o que precisa existir (404), aplicar
a regra do Nucleo e gravar. Um id de outra conta responde 404, igual a um id que não existe.
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

{- A conta chega como uma ação (Handler Usuario), e não como um valor já pronto. Cada handler
executa essa ação primeiro, e sem uma sessão válida ela já responde 401 e nada mais roda.

A ordem dos handlers abaixo precisa ser a mesma das rotas em RotasDaConta (Web/Api.hs).
-}
rotasDaConta :: Pool Connection -> Handler Usuario -> Server RotasDaConta
rotasDaConta pool conta =
         resumo
    :<|> preferencias
    :<|> salvarPrefs
    :<|> listar
    :<|> criar
    :<|> buscar
    :<|> editarBaralhoDaConta
    :<|> excluirBaralhoDaConta
    :<|> cartoes
    :<|> novoCartao
    :<|> revisar
    :<|> revisarTudo
    :<|> estatisticas
    :<|> editarCartaoDaConta
    :<|> excluirCartaoDaConta
    :<|> responderCartao
  where
    idDoUsuario = usuarioId <$> conta

    resumo = do
        idUsuario <- idDoUsuario
        banco pool $ \conn -> do
            dia <- hoje
            tz <- getCurrentTimeZone
            calcularResumo dia <$> diasDeRevisao conn tz idUsuario <*> agendaDaConta conn idUsuario dia

    preferencias = idDoUsuario >>= \idUsuario -> banco pool (\conn -> buscarPreferencias conn idUsuario)

    -- Valores fora da escala já foram recusados com 400 pelo FromJSON de Preferencias antes de chegar aqui.
    salvarPrefs prefs = idDoUsuario >>= \idUsuario -> banco pool (\conn -> salvarPreferencias conn idUsuario prefs)

    listar = do
        idUsuario <- idDoUsuario
        banco pool (\conn -> hoje >>= listarBaralhos conn idUsuario)

    criar dados = do
        idUsuario <- idDoUsuario
        novoBaralho <- validar (validarNovoBaralho dados)
        banco pool (\conn -> criarBaralho conn idUsuario novoBaralho)

    buscarDoUsuario idUsuario idBaralho =
        banco pool (\conn -> hoje >>= \dia -> buscarBaralho conn idUsuario dia idBaralho) >>= encontrado semBaralho

    buscar idBaralho = idDoUsuario >>= \idUsuario -> buscarDoUsuario idUsuario idBaralho

    editarBaralhoDaConta idBaralho dados = do
        idUsuario <- idDoUsuario
        baralhoEditado <- validar (validarNovoBaralho dados)
        banco pool (\conn -> hoje >>= \dia -> editarBaralho conn idUsuario dia idBaralho baralhoEditado) >>= encontrado semBaralho

    excluirBaralhoDaConta idBaralho = do
        idUsuario <- idDoUsuario
        banco pool (\conn -> excluirBaralho conn idUsuario idBaralho) >>= excluido semBaralho

    -- As rotas de um baralho conferem aqui se ele é da conta. Depois disso, as consultas filtram só pelo id do baralho.
    exigirBaralho idBaralho = idDoUsuario >>= \idUsuario -> buscarDoUsuario idUsuario idBaralho >> pure ()

    cartoes idBaralho = do
        exigirBaralho idBaralho
        banco pool (\conn -> listarCartoes conn idBaralho)

    novoCartao idBaralho dados = do
        idUsuario <- idDoUsuario
        cartaoNovo <- validar (validarNovoCartao dados)
        _ <- buscarDoUsuario idUsuario idBaralho
        banco pool (\conn -> hoje >>= \dia -> criarCartao conn idBaralho dia cartaoNovo)

    editarCartaoDaConta idCartao dados = do
        idUsuario <- idDoUsuario
        cartaoEditado <- validar (validarNovoCartao dados)
        banco pool (\conn -> editarCartao conn idUsuario idCartao cartaoEditado) >>= encontrado semCartao

    excluirCartaoDaConta idCartao = do
        idUsuario <- idDoUsuario
        banco pool (\conn -> excluirCartao conn idUsuario idCartao) >>= excluido semCartao

    revisar idBaralho = do
        exigirBaralho idBaralho
        banco pool $ \conn -> do
            dia <- hoje
            map (paraRevisar dia) <$> cartoesParaRevisar conn idBaralho dia

    revisarTudo = do
        idUsuario <- idDoUsuario
        banco pool $ \conn -> do
            dia <- hoje
            map (paraRevisar dia) <$> cartoesParaRevisarDaConta conn idUsuario dia

    estatisticas idBaralho = do
        exigirBaralho idBaralho
        banco pool $ \conn -> do
            dia <- hoje
            tz <- getCurrentTimeZone
            calcularEstatisticas dia <$> listarCartoes conn idBaralho <*> notasDoBaralho conn tz idBaralho

    -- A nota é validada antes de buscar o cartão, então uma nota inválida nunca chega a consultar o banco.
    responderCartao idCartao dados = do
        idUsuario <- idDoUsuario
        nota <- validar (validarResposta dados)
        cartao <- banco pool (\conn -> buscarCartao conn idUsuario idCartao) >>= encontrado semCartao
        dia <- liftIO hoje
        gravado <- banco pool (\conn -> registrarResposta conn cartao nota (responder nota dia (estadoDoCartao cartao)))
        case gravado of
            Just atualizado -> pure atualizado
            -- O cartão mudou entre a leitura e a gravação. Se ele ainda existe, foi respondido em outro lugar (409).
            Nothing -> banco pool (\conn -> buscarCartao conn idUsuario idCartao)
                >>= encontrado semCartao
                >>= \_ -> falhar err409 "o cartão já foi respondido em outra sessão"
