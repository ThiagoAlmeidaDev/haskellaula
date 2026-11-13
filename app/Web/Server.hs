{-# LANGUAGE DataKinds #-}
{-# LANGUAGE OverloadedStrings #-}

{- | Monta a aplicação WAI: liga as rotas públicas e as da conta ao tipo da API, troca os erros
padrão do Servant pelo envelope {"erro": ...} e serve o frontend de frontend/ para o resto.
-}
module Web.Server
    ( aplicacao
    ) where

import qualified Data.ByteString as BS
import Data.Pool (Pool)
import Data.Text (Text)
import qualified Data.Text as T
import Database.PostgreSQL.Simple (Connection)
import Network.HTTP.Types (Status, hContentType, methodPost, methodPut, status404, status415)
import Network.Wai (Request, pathInfo, requestHeaders, requestMethod, responseLBS)
import Servant

import Web.Api
import Web.Baralhos (rotasDaConta)
import Web.Comum (corpoErro, erroJson)
import Web.Contas (autenticar, rotasPublicas)

{- O aeson prefixa as falhas do parseJSON com "Error in <caminho>: ". O texto depois
do prefixo é a mensagem dos FromJSON de Nucleo; sem o prefixo, o corpo nem é JSON.
-}
mensagemDoCorpo :: String -> Text
mensagemDoCorpo bruta = case T.stripPrefix "Error in " (T.pack bruta) of
    Just resto | msg <- T.drop 2 (snd (T.breakOn ": " resto)), not (T.null msg) -> msg
    _ -> "JSON inválido"

formatadores :: ErrorFormatters
formatadores = defaultErrorFormatters
    { bodyParserErrorFormatter = \_ _ bruta -> erroJson err400 (mensagemDoCorpo bruta)
    , urlParseErrorFormatter   = \_ _ _ -> erroJson err400 "parâmetro inválido na URL"
    }

servidor :: Pool Connection -> Server API
servidor pool = (rotasPublicas pool :<|> daConta) :<|> arquivos
  where
    daConta cabecalho = rotasDaConta pool (autenticar pool cabecalho)

{- O Raw recebe tudo que nenhuma rota casou, inclusive o que começa com /api. Ali a resposta
segue o envelope de erro da API em vez do servidor de arquivos.
-}
arquivos :: Server Raw
arquivos = Tagged $ \req enviar -> case pathInfo req of
    ("api" : _) -> let (status, msg) = erroDaApi req
                   in enviar (responseLBS status [(hContentType, "application/json")] (corpoErro msg))
    _           -> estatico req enviar
  where
    Tagged estatico = serveDirectoryFileServer "frontend"

-- Uma rota da API com corpo de outro tipo não casa e chega aqui; por isso o 415 antes do 404.
erroDaApi :: Request -> (Status, Text)
erroDaApi req
    | requestMethod req `elem` [methodPost, methodPut], not corpoJson =
        (status415, "o corpo deve ser enviado como application/json")
    | otherwise = (status404, "rota não encontrada")
  where
    corpoJson = maybe False ("application/json" `BS.isPrefixOf`) (lookup hContentType (requestHeaders req))

aplicacao :: Pool Connection -> Application
aplicacao pool = serveWithContext api (formatadores :. EmptyContext) (servidor pool)
