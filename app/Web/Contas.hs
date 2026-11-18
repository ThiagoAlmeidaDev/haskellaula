{-# LANGUAGE DataKinds #-}
{-# LANGUAGE OverloadedStrings #-}

{- | Handlers de cadastro, login, sessão atual e logout, e também o autenticar, que toda rota da
conta executa antes de qualquer outra coisa. Sem sessão ou com senha errada a resposta é 401, e
com e-mail já cadastrado é 409.
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

-- Usada tanto para e-mail desconhecido quanto para senha errada, para não revelar qual dos dois falhou.
credenciaisErradas :: Text
credenciaisErradas = "e-mail ou senha incorretos"

autenticar :: Pool Connection -> Maybe Text -> Handler Usuario
autenticar pool cabecalho = case cabecalho >>= lerToken of
    Nothing    -> falhar err401 semSessao
    Just token -> banco pool (\conn -> usuarioDaSessao conn (hashToken token)) >>= maybe (falhar err401 semSessao) pure

abrirSessao :: Pool Connection -> Usuario -> Handler (ComCookie Usuario)
abrirSessao pool usuario = do
    token <- liftIO novoToken
    banco pool (\conn -> criarSessao conn (usuarioId usuario) (hashToken token))
    pure (addHeader (cookieSessao token) usuario)

rotasPublicas :: Pool Connection -> Server RotasPublicas
rotasPublicas pool = saude :<|> registrar :<|> entrar :<|> sessaoAtual :<|> sair
  where
    saude :: Handler Value
    saude = do
        _ <- banco pool (\conn -> query_ conn "SELECT 1" :: IO [Only Int])
        pure (object ["banco" .= ("ok" :: Text)])

    -- Valida antes de calcular o bcrypt e de consultar o banco, para que um corpo inválido não custe nenhum dos dois.
    registrar corpo = do
        NovaConta nome email senha <- validar (validarNovaConta corpo)
        senhaHash <- liftIO (hashSenha senha)
        criada <- banco pool (\conn -> criarConta conn nome email senhaHash)
        maybe (falhar err409 "já existe uma conta com este e-mail") (abrirSessao pool) criada

    entrar corpo = do
        Credenciais email senha <- validar (validarCredenciais corpo)
        achado <- banco pool (\conn -> buscarParaLogin conn email)
        case achado of
            Just (usuario, senhaHash) | senhaConfere senha senhaHash -> abrirSessao pool usuario
            _                                                        -> falhar err401 credenciaisErradas

    -- Sem sessão, a resposta é null com status 200, porque "quem está logado?" também tem resposta para um visitante.
    sessaoAtual cabecalho = case cabecalho >>= lerToken of
        Nothing    -> pure Nothing
        Just token -> banco pool (\conn -> usuarioDaSessao conn (hashToken token))

    -- O logout sempre limpa o cookie, mesmo sem uma sessão válida, para o navegador ficar deslogado de qualquer jeito.
    sair cabecalho = do
        case cabecalho >>= lerToken of
            Just token -> banco pool (\conn -> encerrarSessao conn (hashToken token))
            Nothing    -> pure ()
        pure (addHeader cookieExpirado NoContent)
