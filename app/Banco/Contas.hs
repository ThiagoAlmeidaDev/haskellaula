{-# LANGUAGE OverloadedStrings #-}

{- | Consultas de usuários e sessões. Recebe a senha já em hash e o token já em SHA-256: este
módulo nunca vê segredo em claro. Expiração compara instantes (TIMESTAMPTZ), não dias.
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
paraUsuario (i, n, e) = Usuario i n e

{- | Nothing quando o e-mail já tem conta. O ON CONFLICT resolve dois cadastros simultâneos
sem exceção.
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

-- O usuário e o hash da senha, para o login conferir fora do banco.
buscarParaLogin :: Connection -> Text -> IO (Maybe (Usuario, Text))
buscarParaLogin conn email = do
    linhas <- query conn "SELECT id, nome, email, senha_hash FROM usuarios WHERE email = ?" (Only email)
    pure (case linhas of
        [(i, n, e, h)] -> Just (Usuario i n e, h)
        _              -> Nothing)

-- Trinta dias de validade. As sessões vencidas da conta saem no mesmo comando.
criarSessao :: Connection -> Int -> Text -> IO ()
criarSessao conn uid tokenHash = do
    _ <- execute conn
        "WITH limpeza AS (DELETE FROM sessoes WHERE usuario_id = ? AND expira_em <= now()) \
        \INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES (?, ?, now() + interval '30 days')"
        (uid, tokenHash, uid)
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
