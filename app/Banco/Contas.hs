{-# LANGUAGE OverloadedStrings #-}

{- | Consultas de usuários e sessões. A senha já chega aqui em hash e o token já chega em SHA-256,
então este módulo nunca lida com o valor original de nenhum dos dois. A expiração da sessão
compara instantes (TIMESTAMPTZ), e não dias.
-}
module Banco.Contas
    ( criarConta
    , buscarParaLogin
    , criarSessao
    , usuarioDaSessao
    , encerrarSessao
    ) where

import Data.Text (Text)
import Database.PostgreSQL.Simple

import Nucleo.Conta (Usuario (..))

paraUsuario :: (Int, Text, Text) -> Usuario
paraUsuario (idUsuario, nome, email) = Usuario idUsuario nome email

{- | Devolve Nothing quando já existe uma conta com o e-mail. O ON CONFLICT cobre também dois
cadastros com o mesmo e-mail chegando ao mesmo tempo, sem gerar exceção.
-}
criarConta :: Connection -> Text -> Text -> Text -> IO (Maybe Usuario)
criarConta conn nome email senhaHash = do
    linhas <- query conn
        "INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?) \
        \ON CONFLICT (email) DO NOTHING RETURNING id, nome, email"
        (nome, email, senhaHash)
    pure (case linhas of
        [linha] -> Just (paraUsuario linha)
        _       -> Nothing)

-- Devolve o usuário e o hash da senha, para o login conferir a senha fora do banco.
buscarParaLogin :: Connection -> Text -> IO (Maybe (Usuario, Text))
buscarParaLogin conn email = do
    linhas <- query conn "SELECT id, nome, email, senha_hash FROM usuarios WHERE email = ?" (Only email)
    pure (case linhas of
        [(idUsuario, nome, emailSalvo, senhaHash)] -> Just (Usuario idUsuario nome emailSalvo, senhaHash)
        _                                          -> Nothing)

-- A sessão vale por 30 dias. O mesmo comando aproveita para apagar as sessões vencidas da conta.
criarSessao :: Connection -> Int -> Text -> IO ()
criarSessao conn idUsuario tokenHash = do
    _ <- execute conn
        "WITH limpeza AS (DELETE FROM sessoes WHERE usuario_id = ? AND expira_em <= now()) \
        \INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES (?, ?, now() + interval '30 days')"
        (idUsuario, tokenHash, idUsuario)
    pure ()

usuarioDaSessao :: Connection -> Text -> IO (Maybe Usuario)
usuarioDaSessao conn tokenHash = do
    linhas <- query conn
        "SELECT u.id, u.nome, u.email FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id \
        \WHERE s.token_hash = ? AND s.expira_em > now()"
        (Only tokenHash)
    pure (case linhas of
        [linha] -> Just (paraUsuario linha)
        _       -> Nothing)

encerrarSessao :: Connection -> Text -> IO ()
encerrarSessao conn tokenHash = do
    _ <- execute conn "DELETE FROM sessoes WHERE token_hash = ?" (Only tokenHash)
    pure ()
