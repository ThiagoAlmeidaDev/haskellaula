{-# LANGUAGE DataKinds #-}
{-# LANGUAGE OverloadedStrings #-}

{- | Monta a aplicação WAI. Liga as rotas públicas e as da conta ao tipo da API, troca os erros
padrão do Servant pelo formato {"erro": ...} e serve os arquivos de frontend/ para todo o resto.
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

{- O aeson coloca "Error in <caminho>: " antes da mensagem de falha do parseJSON. O que vem
depois disso é a mensagem escrita nos FromJSON do Nucleo. Se o prefixo não estiver lá, o corpo
nem chegou a ser um JSON válido.
-}
mensagemDoCorpo :: String -> Text
mensagemDoCorpo bruta = case T.stripPrefix "Error in " (T.pack bruta) of
    Just resto | mensagem <- T.drop 2 (snd (T.breakOn ": " resto)), not (T.null mensagem) -> mensagem
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

{- O Raw recebe tudo que não casou com nenhuma rota, inclusive caminhos que começam com /api.
Nesses casos a resposta usa o formato de erro da API, e não o do servidor de arquivos.
-}
arquivos :: Server Raw
arquivos = Tagged $ \requisicao enviar -> case pathInfo requisicao of
    ("api" : _) -> let (status, mensagem) = erroDaApi requisicao
                   in enviar (responseLBS status [(hContentType, "application/json")] (corpoErro mensagem))
    _           -> estatico requisicao enviar
  where
    Tagged estatico = serveDirectoryFileServer "frontend"

{- Uma rota da API chamada com um corpo que não é JSON não casa com nenhuma rota e acaba caindo
aqui. Por isso o 415 é testado antes do 404.
-}
erroDaApi :: Request -> (Status, Text)
erroDaApi requisicao
    | requestMethod requisicao `elem` [methodPost, methodPut], not corpoJson =
        (status415, "o corpo deve ser enviado como application/json")
    | otherwise = (status404, "rota não encontrada")
  where
    corpoJson = maybe False ("application/json" `BS.isPrefixOf`) (lookup hContentType (requestHeaders requisicao))

aplicacao :: Pool Connection -> Application
aplicacao pool = serveWithContext api (formatadores :. EmptyContext) (servidor pool)
