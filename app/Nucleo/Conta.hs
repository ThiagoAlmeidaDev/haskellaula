{-# LANGUAGE OverloadedStrings #-}

{- | Núcleo puro das contas: o usuário que a API devolve, os corpos de cadastro e login e a
validação deles. Não faz IO; o hash da senha e a sessão ficam em Banco.Contas e Web.Sessao.
-}
module Nucleo.Conta
    ( Usuario (..)
    , NovaConta (..)
    , Credenciais (..)
    , validarNovaConta
    , validarCredenciais
    ) where

import Data.Aeson
import qualified Data.ByteString as BS
import Data.Char (isAlphaNum, isDigit, isLower, isSpace, isUpper)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE

import Nucleo.Types (corpo, texto)

data Usuario = Usuario
    { usuarioId    :: Int
    , usuarioNome  :: Text
    , usuarioEmail :: Text
    } deriving (Eq, Show)

data NovaConta = NovaConta
    { contaNome  :: Text
    , contaEmail :: Text
    , contaSenha :: Text
    } deriving (Eq, Show)

data Credenciais = Credenciais
    { credEmail :: Text
    , credSenha :: Text
    } deriving (Eq, Show)

erroNomeConta, erroNomeLongo, erroEmail, erroSenhaCurta, erroSenhaLonga, erroCredenciais :: Text
erroNomeConta   = "informe seu nome"
erroNomeLongo   = "o nome deve ter no máximo 80 caracteres"
erroEmail       = "e-mail inválido"
erroSenhaCurta  = "a senha deve ter pelo menos 8 caracteres"
erroSenhaLonga  = "a senha é longa demais"
erroCredenciais = "informe e-mail e senha"

instance ToJSON Usuario where
    toJSON u = object
        [ "id"    .= usuarioId u
        , "nome"  .= usuarioNome u
        , "email" .= usuarioEmail u
        ]

instance FromJSON NovaConta where
    parseJSON = corpo $ \o -> NovaConta
        <$> texto "nome" erroNomeConta o
        <*> texto "email" erroEmail o
        <*> texto "senha" erroSenhaCurta o

instance FromJSON Credenciais where
    parseJSON = corpo $ \o -> Credenciais
        <$> texto "email" erroCredenciais o
        <*> texto "senha" erroCredenciais o

-- O e-mail é a chave da conta: a mesma pessoa digitando com outra caixa acha a mesma conta.
normalizarEmail :: Text -> Text
normalizarEmail = T.toLower . T.strip

{- | Recusa o que certamente não é endereço (sem arroba, duas arrobas, espaço, domínio sem
ponto). A confirmação de que o endereço existe não faz parte do cadastro.
-}
emailValido :: Text -> Bool
emailValido e = case T.splitOn "@" e of
    [usuario, dominio] ->
        not (T.null usuario)
            && T.length e <= 254
            && not (T.any (== ' ') e)
            && T.isInfixOf "." dominio
            && not (T.isPrefixOf "." dominio)
            && not (T.isSuffixOf "." dominio)
    _ -> False

{- | A senha não passa por strip: espaço nas pontas faz parte do que a pessoa digitou. O
teto é em bytes UTF-8 porque o bcrypt só usa os primeiros 72 bytes. Letra acentuada conta
como letra; símbolo é o que não é letra, número nem espaço.
-}
validarSenha :: Text -> Either Text Text
validarSenha s
    | T.length s < 8                     = Left erroSenhaCurta
    | BS.length (TE.encodeUtf8 s) > 72   = Left erroSenhaLonga
    | not (T.any isUpper s)              = Left "a senha precisa de uma letra maiúscula"
    | not (T.any isLower s)              = Left "a senha precisa de uma letra minúscula"
    | not (T.any isDigit s)              = Left "a senha precisa de um número"
    | not (T.any simbolo s)              = Left "a senha precisa de um símbolo"
    | otherwise                          = Right s
  where
    simbolo c = not (isAlphaNum c) && not (isSpace c)

validarNome :: Text -> Either Text Text
validarNome n
    | T.null limpo        = Left erroNomeConta
    | T.length limpo > 80 = Left erroNomeLongo
    | otherwise           = Right limpo
  where
    limpo = T.strip n

validarEmail :: Text -> Either Text Text
validarEmail e
    | emailValido limpo = Right limpo
    | otherwise         = Left erroEmail
  where
    limpo = normalizarEmail e

validarNovaConta :: NovaConta -> Either Text NovaConta
validarNovaConta (NovaConta n e s) = NovaConta <$> validarNome n <*> validarEmail e <*> validarSenha s

-- O login não repete as regras do cadastro: senha fora delas só não confere.
validarCredenciais :: Credenciais -> Either Text Credenciais
validarCredenciais (Credenciais e s)
    | T.null email || T.null s = Left erroCredenciais
    | otherwise                = Right (Credenciais email s)
  where
    email = normalizarEmail e
