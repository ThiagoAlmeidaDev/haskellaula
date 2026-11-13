{-# LANGUAGE OverloadedStrings #-}

{- | Segredos da conta: hash bcrypt da senha, token aleatório da sessão, o SHA-256 que o banco
guarda no lugar dele e o cookie HttpOnly que leva o token ao navegador.
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

-- Custo 12 do bcrypt: na casa de centenas de milissegundos por tentativa de senha.
hashSenha :: Text -> IO Text
hashSenha s = TE.decodeLatin1 <$> (hashPassword 12 (TE.encodeUtf8 s) :: IO BS.ByteString)

-- O bcrypt só lê 72 bytes; senha maior nunca foi aceita no cadastro, então não confere.
senhaConfere :: Text -> Text -> Bool
senhaConfere s h
    | BS.length bytes > 72 = False
    | otherwise            = validatePassword bytes (TE.encodeUtf8 h)
  where
    bytes = TE.encodeUtf8 s

-- 32 bytes do gerador do sistema, em hexadecimal para caber no cookie sem escape.
novoToken :: IO Text
novoToken = TE.decodeLatin1 . convertToBase Base16 <$> (getRandomBytes 32 :: IO BS.ByteString)

hashToken :: Text -> Text
hashToken t = T.pack (show (hashWith SHA256 (TE.encodeUtf8 t)))

-- O valor do cookie da sessão dentro do cabeçalho Cookie, que traz todos os cookies do site.
lerToken :: Text -> Maybe Text
lerToken cabecalho = case [v | (k, v) <- map par (T.splitOn ";" cabecalho), k == nomeCookie, not (T.null v)] of
    (v : _) -> Just v
    []      -> Nothing
  where
    par item = let (k, v) = T.breakOn "=" (T.strip item) in (k, T.drop 1 v)

{- | HttpOnly deixa o token fora do alcance do JavaScript da página; SameSite=Strict impede que
outro site dispare requisições com ele. Sem Secure porque o servidor local roda em http.
-}
cookieSessao :: Text -> Text
cookieSessao token = nomeCookie <> "=" <> token <> "; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000"

cookieExpirado :: Text
cookieExpirado = nomeCookie <> "=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
