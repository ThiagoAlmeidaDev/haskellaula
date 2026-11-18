{-# LANGUAGE OverloadedStrings #-}

{- | As regras das contas: o usuário que a API devolve, os corpos de cadastro e de login e a
validação deles. Este módulo não faz IO. O hash da senha e a sessão ficam em Banco.Contas e
Web.Sessao.
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
    { credenciaisEmail :: Text
    , credenciaisSenha :: Text
    } deriving (Eq, Show)

erroNomeConta, erroNomeLongo, erroEmail, erroSenhaCurta, erroSenhaLonga, erroCredenciais :: Text
erroNomeConta   = "informe seu nome"
erroNomeLongo   = "o nome deve ter no máximo 80 caracteres"
erroEmail       = "e-mail inválido"
erroSenhaCurta  = "a senha deve ter pelo menos 8 caracteres"
erroSenhaLonga  = "a senha é longa demais"
erroCredenciais = "informe e-mail e senha"

instance ToJSON Usuario where
    toJSON usuario = object
        [ "id"    .= usuarioId usuario
        , "nome"  .= usuarioNome usuario
        , "email" .= usuarioEmail usuario
        ]

instance FromJSON NovaConta where
    parseJSON = corpo $ \objeto -> NovaConta
        <$> texto "nome" erroNomeConta objeto
        <*> texto "email" erroEmail objeto
        <*> texto "senha" erroSenhaCurta objeto

instance FromJSON Credenciais where
    parseJSON = corpo $ \objeto -> Credenciais
        <$> texto "email" erroCredenciais objeto
        <*> texto "senha" erroCredenciais objeto

-- O e-mail identifica a conta, então "Ana@X.com" e "ana@x.com" precisam levar à mesma conta.
normalizarEmail :: Text -> Text
normalizarEmail = T.toLower . T.strip

{- | Recusa só o que com certeza não é um endereço de e-mail (sem arroba, com duas arrobas, com
espaço ou com domínio sem ponto). O cadastro não confere se o endereço existe de verdade.
-}
emailValido :: Text -> Bool
emailValido email = case T.splitOn "@" email of
    [usuario, dominio] ->
        not (T.null usuario)
            && T.length email <= 254
            && not (T.any (== ' ') email)
            && T.isInfixOf "." dominio
            && not (T.isPrefixOf "." dominio)
            && not (T.isSuffixOf "." dominio)
    _ -> False

{- | A senha não passa por strip, porque os espaços nas pontas fazem parte do que a pessoa
digitou. O limite máximo é contado em bytes UTF-8, já que o bcrypt só usa os primeiros 72 bytes.
Letra acentuada conta como letra, e símbolo é qualquer caractere que não seja letra, número ou
espaço.
-}
validarSenha :: Text -> Either Text Text
validarSenha senha
    | T.length senha < 8                     = Left erroSenhaCurta
    | BS.length (TE.encodeUtf8 senha) > 72   = Left erroSenhaLonga
    | not (T.any isUpper senha)              = Left "a senha precisa de uma letra maiúscula"
    | not (T.any isLower senha)              = Left "a senha precisa de uma letra minúscula"
    | not (T.any isDigit senha)              = Left "a senha precisa de um número"
    | not (T.any simbolo senha)              = Left "a senha precisa de um símbolo"
    | otherwise                              = Right senha
  where
    simbolo caractere = not (isAlphaNum caractere) && not (isSpace caractere)

validarNome :: Text -> Either Text Text
validarNome nomeDigitado
    | T.null limpo        = Left erroNomeConta
    | T.length limpo > 80 = Left erroNomeLongo
    | otherwise           = Right limpo
  where
    limpo = T.strip nomeDigitado

validarEmail :: Text -> Either Text Text
validarEmail emailDigitado
    | emailValido limpo = Right limpo
    | otherwise         = Left erroEmail
  where
    limpo = normalizarEmail emailDigitado

validarNovaConta :: NovaConta -> Either Text NovaConta
validarNovaConta (NovaConta nome email senha) = NovaConta <$> validarNome nome <*> validarEmail email <*> validarSenha senha

-- O login não aplica as regras de senha do cadastro. Uma senha fora delas simplesmente não confere.
validarCredenciais :: Credenciais -> Either Text Credenciais
validarCredenciais (Credenciais emailDigitado senha)
    | T.null email || T.null senha = Left erroCredenciais
    | otherwise                    = Right (Credenciais email senha)
  where
    email = normalizarEmail emailDigitado
