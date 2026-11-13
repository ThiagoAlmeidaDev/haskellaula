{-# LANGUAGE DataKinds #-}
{-# LANGUAGE OverloadedStrings #-}

{- | Handlers de cadastro, login, sessão atual e saída, e o autenticar que toda rota da conta
roda antes de qualquer outra coisa. Falta de sessão ou senha errada é 401; e-mail repetido, 409.
-}
module Web.Contas
    ( rotasPublicas
    , autenticar
    ) where

import Control.Monad.IO.Class (liftIO)
import Data.Aeson (Value, object, (.=))
import Data.Pool (Pool)
import Data.Text (Text)
import Database.PostgreSQL.Simple (Connection, Only (..), query_)
import Servant

import Banco.Contas
import Nucleo.Conta
import Web.Api (ComCookie, RotasPublicas)
import Web.Comum (banco, falhar, validar)
import Web.Sessao

semSessao :: Text
semSessao = "faça login para continuar"

-- O mesmo texto para e-mail desconhecido e senha errada: a resposta não revela qual dos dois.
credenciaisErradas :: Text
credenciaisErradas = "e-mail ou senha incorretos"

autenticar :: Pool Connection -> Maybe Text -> Handler Usuario
autenticar pool cabecalho = case cabecalho >>= lerToken of
    Nothing    -> falhar err401 semSessao
    Just token -> banco pool (\conn -> usuarioDaSessao conn (hashToken token)) >>= maybe (falhar err401 semSessao) pure

abrirSessao :: Pool Connection -> Usuario -> Handler (ComCookie Usuario)
abrirSessao pool u = do
    token <- liftIO novoToken
    banco pool (\conn -> criarSessao conn (usuarioId u) (hashToken token))
    pure (addHeader (cookieSessao token) u)

rotasPublicas :: Pool Connection -> Server RotasPublicas
rotasPublicas pool = saude :<|> registrar :<|> entrar :<|> sessaoAtual :<|> sair
  where
    saude :: Handler Value
    saude = do
        _ <- banco pool (\conn -> query_ conn "SELECT 1" :: IO [Only Int])
        pure (object ["banco" .= ("ok" :: Text)])

    -- Valida antes do bcrypt e do banco: corpo inválido não custa hash nem consulta.
    registrar corpo = do
        NovaConta n e s <- validar (validarNovaConta corpo)
        h <- liftIO (hashSenha s)
        criada <- banco pool (\conn -> criarConta conn n e h)
        maybe (falhar err409 "já existe uma conta com este e-mail") (abrirSessao pool) criada

    entrar corpo = do
        Credenciais e s <- validar (validarCredenciais corpo)
        achado <- banco pool (\conn -> buscarParaLogin conn e)
        case achado of
            Just (u, h) | senhaConfere s h -> abrirSessao pool u
            _                              -> falhar err401 credenciaisErradas

    -- Sem sessão a resposta é null com 200: "quem está logado" tem resposta para o visitante também.
    sessaoAtual cabecalho = case cabecalho >>= lerToken of
        Nothing    -> pure Nothing
        Just token -> banco pool (\conn -> usuarioDaSessao conn (hashToken token))

    -- Sair sempre limpa o cookie, mesmo sem sessão válida: o navegador fica deslogado de todo jeito.
    sair cabecalho = do
        case cabecalho >>= lerToken of
            Just token -> banco pool (\conn -> encerrarSessao conn (hashToken token))
            Nothing    -> pure ()
        pure (addHeader cookieExpirado NoContent)
