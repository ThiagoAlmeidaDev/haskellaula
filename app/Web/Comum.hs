{-# LANGUAGE OverloadedStrings #-}

{- | Funções que todos os handlers usam: o formato de erro {"erro": ...}, os atalhos para 400,
404 e 409, o acesso ao banco pelo pool e o "hoje" no dia local do servidor.
-}
module Web.Comum
    ( banco
    , hoje
    , corpoErro
    , erroJson
    , falhar
    , validar
    , encontrado
    , excluido
    ) where

import Control.Monad.IO.Class (liftIO)
import Data.Aeson (encode, object, (.=))
import qualified Data.ByteString.Lazy as LBS
import Data.Pool (Pool, withResource)
import Data.Text (Text)
import Data.Time (Day, getZonedTime, localDay, zonedTimeToLocalTime)
import Database.PostgreSQL.Simple (Connection)
import Network.HTTP.Types (hContentType)
import Servant

-- Cada acesso usa uma conexão própria do pool, porque a libpq não aceita duas consultas ao mesmo tempo na mesma conexão.
banco :: Pool Connection -> (Connection -> IO a) -> Handler a
banco pool = liftIO . withResource pool

-- | O dia local do servidor. Se fosse usado o dia em UTC, ele viraria às 21h no Brasil e as revisões seriam antecipadas.
hoje :: IO Day
hoje = localDay . zonedTimeToLocalTime <$> getZonedTime

corpoErro :: Text -> LBS.ByteString
corpoErro mensagem = encode (object ["erro" .= mensagem])

erroJson :: ServerError -> Text -> ServerError
erroJson erro mensagem = erro { errBody = corpoErro mensagem, errHeaders = [(hContentType, "application/json")] }

falhar :: ServerError -> Text -> Handler a
falhar erro mensagem = throwError (erroJson erro mensagem)

validar :: Either Text a -> Handler a
validar = either (falhar err400) pure

encontrado :: Text -> Maybe a -> Handler a
encontrado mensagem = maybe (falhar err404 mensagem) pure

excluido :: Text -> Bool -> Handler NoContent
excluido _ True         = pure NoContent
excluido mensagem False = falhar err404 mensagem
