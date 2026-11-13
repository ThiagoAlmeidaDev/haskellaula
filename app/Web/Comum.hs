{-# LANGUAGE OverloadedStrings #-}

{- | Peças que todo handler usa: o envelope de erro {"erro": ...}, os atalhos de 400, 404 e
409, o acesso ao banco pelo pool e o "hoje" no dia local do servidor.
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

-- Cada acesso pega uma conexão só sua: a libpq não aceita duas consultas ao mesmo tempo na mesma.
banco :: Pool Connection -> (Connection -> IO a) -> Handler a
banco pool = liftIO . withResource pool

-- | O dia local do servidor. O dia UTC vira às 21h no Brasil e anteciparia as revisões.
hoje :: IO Day
hoje = localDay . zonedTimeToLocalTime <$> getZonedTime

corpoErro :: Text -> LBS.ByteString
corpoErro msg = encode (object ["erro" .= msg])

erroJson :: ServerError -> Text -> ServerError
erroJson e msg = e { errBody = corpoErro msg, errHeaders = [(hContentType, "application/json")] }

falhar :: ServerError -> Text -> Handler a
falhar e msg = throwError (erroJson e msg)

validar :: Either Text a -> Handler a
validar = either (falhar err400) pure

encontrado :: Text -> Maybe a -> Handler a
encontrado msg = maybe (falhar err404 msg) pure

excluido :: Text -> Bool -> Handler NoContent
excluido _ True    = pure NoContent
excluido msg False = falhar err404 msg
