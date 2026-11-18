{-# LANGUAGE OverloadedStrings #-}

{- | A parte de segurança da conta: o hash bcrypt da senha, o token aleatório da sessão, o SHA-256
desse token (que é o que o banco guarda) e o cookie HttpOnly que leva o token ao navegador.
-}
module Web.Sessao
    ( hashSenha
    , senhaConfere
    , novoToken
    , hashToken
    , lerToken
    , cookieSessao
    , cookieExpirado
    ) where

import Crypto.Hash (SHA256 (..), hashWith)
import Crypto.KDF.BCrypt (hashPassword, validatePassword)
import Crypto.Random (getRandomBytes)
import qualified Data.ByteString as BS
import Data.ByteArray.Encoding (Base (Base16), convertToBase)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE

nomeCookie :: Text
nomeCookie = "recall_sessao"

-- Custo 12 faz cada tentativa de senha levar algumas centenas de milissegundos.
hashSenha :: Text -> IO Text
hashSenha senha = TE.decodeLatin1 <$> (hashPassword 12 (TE.encodeUtf8 senha) :: IO BS.ByteString)

-- O bcrypt só lê 72 bytes. Uma senha maior que isso nunca foi aceita no cadastro, então não pode conferir.
senhaConfere :: Text -> Text -> Bool
senhaConfere senha senhaHash
    | BS.length bytes > 72 = False
    | otherwise            = validatePassword bytes (TE.encodeUtf8 senhaHash)
  where
    bytes = TE.encodeUtf8 senha

-- 32 bytes aleatórios do sistema, em hexadecimal para caberem no cookie sem precisar de escape.
novoToken :: IO Text
novoToken = TE.decodeLatin1 . convertToBase Base16 <$> (getRandomBytes 32 :: IO BS.ByteString)

hashToken :: Text -> Text
hashToken token = T.pack (show (hashWith SHA256 (TE.encodeUtf8 token)))

-- Procura o cookie da sessão dentro do cabeçalho Cookie, que traz todos os cookies do site juntos.
lerToken :: Text -> Maybe Text
lerToken cabecalho =
    case [valor | (nomeDoCookie, valor) <- map separar (T.splitOn ";" cabecalho), nomeDoCookie == nomeCookie, not (T.null valor)] of
        (valor : _) -> Just valor
        []          -> Nothing
  where
    separar item = let (nomeDoCookie, resto) = T.breakOn "=" (T.strip item) in (nomeDoCookie, T.drop 1 resto)

{- | HttpOnly impede que o JavaScript da página leia o token, e SameSite=Strict impede que outro
site faça requisições usando esse cookie. Não tem Secure porque o servidor local roda em http.
-}
cookieSessao :: Text -> Text
cookieSessao token = nomeCookie <> "=" <> token <> "; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000"

cookieExpirado :: Text
cookieExpirado = nomeCookie <> "=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
