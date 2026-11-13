{-# LANGUAGE OverloadedStrings #-}

{- | Núcleo puro das preferências de estudo da conta: tamanho do texto da pergunta e da resposta,
se a pergunta continua visível depois de revelar, como a resposta aparece, a fonte do cartão, o
tema e se a sessão embaralha. O JSON recusa valor fora da escala com a mensagem que a API devolve.
-}
module Nucleo.Preferencias
    ( Preferencias (..)
    , Revelar (..)
    , Fonte (..)
    , Tema (..)
    , preferenciasPadrao
    , revelarTexto
    , fonteTexto
    , temaTexto
    , lerRevelar
    , lerFonte
    , lerTema
    ) where

import Data.Aeson
import Data.Aeson.Types (Parser)
import Data.Scientific (toBoundedInteger)
import Data.Text (Text)
import qualified Data.Text as T

import Nucleo.Types (corpo)

data Revelar = Virar | Abaixo deriving (Eq, Show, Enum, Bounded)

data Fonte = SemSerifa | Serifa | Manuscrita deriving (Eq, Show, Enum, Bounded)

data Tema = Claro | Escuro | Sistema deriving (Eq, Show, Enum, Bounded)

-- | Os tamanhos vão de 1 a 8; o frontend traduz cada passo em pixels.
data Preferencias = Preferencias
    { tamanhoPergunta :: Int
    , tamanhoResposta :: Int
    , mostrarPergunta :: Bool
    , revelar         :: Revelar
    , fonte           :: Fonte
    , tema            :: Tema
    , embaralhar      :: Bool
    } deriving (Eq, Show)

preferenciasPadrao :: Preferencias
preferenciasPadrao = Preferencias 3 3 True Virar SemSerifa Sistema False

revelarTexto :: Revelar -> Text
revelarTexto Virar  = "virar"
revelarTexto Abaixo = "abaixo"

fonteTexto :: Fonte -> Text
fonteTexto SemSerifa  = "sem-serifa"
fonteTexto Serifa     = "serifa"
fonteTexto Manuscrita = "manuscrita"

temaTexto :: Tema -> Text
temaTexto Claro   = "claro"
temaTexto Escuro  = "escuro"
temaTexto Sistema = "sistema"

-- O inverso de cada *Texto, usado pelo JSON e pela leitura do banco.
lerPor :: (Enum a, Bounded a) => (a -> Text) -> Text -> Maybe a
lerPor nomeDe t = lookup t [(nomeDe v, v) | v <- [minBound .. maxBound]]

lerRevelar :: Text -> Maybe Revelar
lerRevelar = lerPor revelarTexto

lerFonte :: Text -> Maybe Fonte
lerFonte = lerPor fonteTexto

lerTema :: Text -> Maybe Tema
lerTema = lerPor temaTexto

instance ToJSON Preferencias where
    toJSON p = object
        [ "tamanhoPergunta" .= tamanhoPergunta p
        , "tamanhoResposta" .= tamanhoResposta p
        , "mostrarPergunta" .= mostrarPergunta p
        , "revelar"         .= revelarTexto (revelar p)
        , "fonte"           .= fonteTexto (fonte p)
        , "tema"            .= temaTexto (tema p)
        , "embaralhar"      .= embaralhar p
        ]

tamanho :: Key -> Object -> Parser Int
tamanho chave o = do
    v <- o .:? chave
    case v of
        Just (Number n) | Just i <- toBoundedInteger n, i >= 1, i <= 8 -> pure i
        _ -> fail "o tamanho do texto deve estar entre 1 e 8"

booleano :: Key -> Text -> Object -> Parser Bool
booleano chave erro o = do
    v <- o .:? chave
    case v of
        Just (Bool b) -> pure b
        _             -> fail (T.unpack erro)

opcao :: (Text -> Maybe a) -> Key -> Text -> Object -> Parser a
opcao ler chave erro o = do
    v <- o .:? chave
    case v of
        Just (String t) | Just x <- ler t -> pure x
        _                                 -> fail (T.unpack erro)

-- O corpo do PUT traz as preferências inteiras; campo ausente é recusado como inválido.
instance FromJSON Preferencias where
    parseJSON = corpo $ \o -> Preferencias
        <$> tamanho "tamanhoPergunta" o
        <*> tamanho "tamanhoResposta" o
        <*> booleano "mostrarPergunta" "mostrarPergunta deve ser verdadeiro ou falso" o
        <*> opcao lerRevelar "revelar" "revelar deve ser virar ou abaixo" o
        <*> opcao lerFonte "fonte" "fonte inválida" o
        <*> opcao lerTema "tema" "tema inválido" o
        <*> booleano "embaralhar" "embaralhar deve ser verdadeiro ou falso" o
