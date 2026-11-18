{-# LANGUAGE OverloadedStrings #-}

{- | As preferências de estudo de cada conta: o tamanho do texto da pergunta e da resposta, se a
pergunta continua visível depois de revelar, como a resposta aparece, a fonte do cartão, o tema
e se a sessão embaralha os cartões. Valores fora da escala são recusados já na leitura do JSON,
com a mensagem que a API devolve.
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

-- | Os tamanhos vão de 1 a 8, e o frontend converte cada passo em pixels.
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

-- Faz o caminho inverso das funções *Texto. É usado na leitura do JSON e do banco.
lerPor :: (Enum a, Bounded a) => (a -> Text) -> Text -> Maybe a
lerPor nomeDe textoLido = lookup textoLido [(nomeDe opcaoPossivel, opcaoPossivel) | opcaoPossivel <- [minBound .. maxBound]]

lerRevelar :: Text -> Maybe Revelar
lerRevelar = lerPor revelarTexto

lerFonte :: Text -> Maybe Fonte
lerFonte = lerPor fonteTexto

lerTema :: Text -> Maybe Tema
lerTema = lerPor temaTexto

instance ToJSON Preferencias where
    toJSON prefs = object
        [ "tamanhoPergunta" .= tamanhoPergunta prefs
        , "tamanhoResposta" .= tamanhoResposta prefs
        , "mostrarPergunta" .= mostrarPergunta prefs
        , "revelar"         .= revelarTexto (revelar prefs)
        , "fonte"           .= fonteTexto (fonte prefs)
        , "tema"            .= temaTexto (tema prefs)
        , "embaralhar"      .= embaralhar prefs
        ]

tamanho :: Key -> Object -> Parser Int
tamanho chave objeto = do
    valor <- objeto .:? chave
    case valor of
        Just (Number numero) | Just inteiro <- toBoundedInteger numero, inteiro >= 1, inteiro <= 8 -> pure inteiro
        _ -> fail "o tamanho do texto deve estar entre 1 e 8"

booleano :: Key -> Text -> Object -> Parser Bool
booleano chave erro objeto = do
    valor <- objeto .:? chave
    case valor of
        Just (Bool lido) -> pure lido
        _                -> fail (T.unpack erro)

opcao :: (Text -> Maybe a) -> Key -> Text -> Object -> Parser a
opcao ler chave erro objeto = do
    valor <- objeto .:? chave
    case valor of
        Just (String conteudo) | Just lido <- ler conteudo -> pure lido
        _                                               -> fail (T.unpack erro)

-- O PUT manda todas as preferências de uma vez, e um campo que faltar é recusado como inválido.
instance FromJSON Preferencias where
    parseJSON = corpo $ \objeto -> Preferencias
        <$> tamanho "tamanhoPergunta" objeto
        <*> tamanho "tamanhoResposta" objeto
        <*> booleano "mostrarPergunta" "mostrarPergunta deve ser verdadeiro ou falso" objeto
        <*> opcao lerRevelar "revelar" "revelar deve ser virar ou abaixo" objeto
        <*> opcao lerFonte "fonte" "fonte inválida" objeto
        <*> opcao lerTema "tema" "tema inválido" objeto
        <*> booleano "embaralhar" "embaralhar deve ser verdadeiro ou falso" objeto
