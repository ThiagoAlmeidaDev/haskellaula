{-# LANGUAGE OverloadedStrings #-}

{- | Ponto de entrada do servidor: lê DATABASE_URL, abre o pool de conexões, confere o banco
na subida e serve a API e o frontend na porta 8080.
-}
module Main where

import qualified Data.ByteString.Char8 as BS
import Data.Maybe (fromMaybe)
import Data.Pool (defaultPoolConfig, newPool, withResource)
import Database.PostgreSQL.Simple (Only (..), close, connectPostgreSQL, query_)
import Network.Wai.Handler.Warp (run)
import System.Environment (lookupEnv)

import Web.Server (aplicacao)

urlPadrao :: String
urlPadrao = "host=localhost port=5432 dbname=flashcards user=flashcards password=flashcards"

main :: IO ()
main = do
    url <- fromMaybe urlPadrao <$> lookupEnv "DATABASE_URL"
    pool <- newPool (defaultPoolConfig (connectPostgreSQL (BS.pack url)) close 60 10)
    -- Falha na subida, e não na primeira requisição, se o banco não estiver de pé.
    _ <- withResource pool (\conn -> query_ conn "SELECT 1" :: IO [Only Int])
    putStrLn "Serving on port 8080"
    run 8080 (aplicacao pool)
