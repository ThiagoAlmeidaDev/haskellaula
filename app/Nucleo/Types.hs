{-# LANGUAGE OverloadedStrings #-}

{- | Núcleo puro dos registros da API (baralho, cartão, resposta): o JSON de entrada e saída, a
validação que roda antes de qualquer IO, a etapa de cada cartão e os prazos de cada nota na
revisão. A mensagem de erro do corpo sai daqui.
-}
module Nucleo.Types
    ( Baralho (..)
    , NovoBaralho (..)
    , Cartao (..)
    , NovoCartao (..)
    , Resposta (..)
    , Visual (..)
    , Cor (..)
    , Padrao (..)
    , visualPadrao
    , corTexto
    , padraoTexto
    , lerCor
    , lerPadrao
    , Etapa (..)
    , Etapas (..)
    , semEtapas
    , etapaDe
    , contarEtapas
    , Previsao (..)
    , ParaRevisar (..)
    , estadoDoCartao
    , previsoesDe
    , paraRevisar
    , validarNovoBaralho
    , validarNovoCartao
    , validarResposta
    , corpo
    , texto
    ) where

import Data.Aeson
import qualified Data.Aeson.Key as K
import qualified Data.Aeson.KeyMap as KM
import Data.Aeson.Types (Parser)
import Data.Scientific (toBoundedInteger)
import Data.Text (Text)
import qualified Data.Text as T
import Data.Maybe (mapMaybe)
import Data.Time (Day, diffDays)

import Nucleo.SM2 (EstadoCartao (..), Nota, mkNota, notaValor, responder)

data Baralho = Baralho
    { baralhoId    :: Int
    , nome         :: Text
    , descricao    :: Text
    , totalCartoes :: Int
    , paraHoje     :: Int
    , etapas       :: Etapas
    , visual       :: Visual
    } deriving (Eq, Show)

-- | A capa do baralho: uma cor da paleta do frontend e uma estampa.
data Visual = Visual
    { cor    :: Cor
    , padrao :: Padrao
    } deriving (Eq, Show)

data Cor = Cobalto | Tomate | Sol | Hortela | Chiclete | Ceu | Terra | Grafite
    deriving (Eq, Show, Enum, Bounded)

data Padrao = Liso | Bolinhas | Listras | Xadrez deriving (Eq, Show, Enum, Bounded)

visualPadrao :: Visual
visualPadrao = Visual Cobalto Liso

corTexto :: Cor -> Text
corTexto c = case c of
    Cobalto  -> "cobalto"
    Tomate   -> "tomate"
    Sol      -> "sol"
    Hortela  -> "hortela"
    Chiclete -> "chiclete"
    Ceu      -> "ceu"
    Terra    -> "terra"
    Grafite  -> "grafite"

padraoTexto :: Padrao -> Text
padraoTexto p = case p of
    Liso     -> "liso"
    Bolinhas -> "bolinhas"
    Listras  -> "listras"
    Xadrez   -> "xadrez"

lerCor :: Text -> Maybe Cor
lerCor t = lookup t [(corTexto c, c) | c <- [minBound .. maxBound]]

lerPadrao :: Text -> Maybe Padrao
lerPadrao t = lookup t [(padraoTexto p, p) | p <- [minBound .. maxBound]]

data Etapa = Novo | Aprendendo | Dominado deriving (Eq, Show)

data Etapas = Etapas
    { novos      :: Int
    , aprendendo :: Int
    , dominados  :: Int
    } deriving (Eq, Show)

semEtapas :: Etapas
semEtapas = Etapas 0 0 0

{- | Recebe repetições e intervalo. Novo: nunca respondido. Dominado: intervalo de 21 dias ou
mais, o limite de cartão maduro do Anki. O resto, inclusive o cartão recém-errado, aprende.
-}
etapaDe :: Int -> Int -> Etapa
etapaDe reps int
    | reps == 0 && int == 0 = Novo
    | int >= 21             = Dominado
    | otherwise             = Aprendendo

-- | Conta as etapas de pares (repetições, intervalo).
contarEtapas :: [(Int, Int)] -> Etapas
contarEtapas = foldr somar semEtapas
  where
    somar (r, i) (Etapas n a d) = case etapaDe r i of
        Novo       -> Etapas (n + 1) a d
        Aprendendo -> Etapas n (a + 1) d
        Dominado   -> Etapas n a (d + 1)

data NovoBaralho = NovoBaralho
    { nbNome      :: Text
    , nbDescricao :: Text
    , nbVisual    :: Visual
    } deriving (Eq, Show)

data Cartao = Cartao
    { cartaoId        :: Int
    , cBaralhoId      :: Int
    , frente          :: Text
    , verso           :: Text
    , cFacilidade     :: Double
    , cIntervalo      :: Int
    , cRepeticoes     :: Int
    , cProximaRevisao :: Day
    } deriving (Eq, Show)

data NovoCartao = NovoCartao
    { ncFrente :: Text
    , ncVerso  :: Text
    } deriving (Eq, Show)

newtype Resposta = Resposta { rNota :: Int } deriving (Eq, Show)

erroNome, erroFrente, erroVerso, erroNota :: Text
erroNome   = "nome é obrigatório"
erroFrente = "frente é obrigatória"
erroVerso  = "verso é obrigatório"
erroNota   = "nota deve estar entre 0 e 5"

instance ToJSON Baralho where
    toJSON b = object
        [ "id"           .= baralhoId b
        , "nome"         .= nome b
        , "descricao"    .= descricao b
        , "totalCartoes" .= totalCartoes b
        , "paraHoje"     .= paraHoje b
        , "etapas"       .= etapas b
        , "cor"          .= corTexto (cor (visual b))
        , "padrao"       .= padraoTexto (padrao (visual b))
        ]

instance ToJSON Etapas where
    toJSON e = object
        [ "novos"      .= novos e
        , "aprendendo" .= aprendendo e
        , "dominados"  .= dominados e
        ]

instance ToJSON Etapa where
    toJSON Novo       = String "novo"
    toJSON Aprendendo = String "aprendendo"
    toJSON Dominado   = String "dominado"

instance ToJSON Cartao where
    toJSON c = object
        [ "id"             .= cartaoId c
        , "baralhoId"      .= cBaralhoId c
        , "frente"         .= frente c
        , "verso"          .= verso c
        , "facilidade"     .= cFacilidade c
        , "intervalo"      .= cIntervalo c
        , "repeticoes"     .= cRepeticoes c
        , "proximaRevisao" .= cProximaRevisao c
        , "etapa"          .= etapaDe (cRepeticoes c) (cIntervalo c)
        ]

-- | O prazo em dias que uma nota daria ao cartão se fosse a resposta de hoje.
data Previsao = Previsao Int Integer deriving (Eq, Show)

-- | Um cartão devido, com o prazo de cada nota para a tela de estudo mostrar antes da resposta.
data ParaRevisar = ParaRevisar Cartao [Previsao] deriving (Eq, Show)

instance ToJSON Previsao where
    toJSON (Previsao n d) = object ["nota" .= n, "dias" .= d]

-- O cartão sai com as mesmas chaves de sempre, mais a lista de previsões.
instance ToJSON ParaRevisar where
    toJSON (ParaRevisar c ps) = case toJSON c of
        Object o -> Object (KM.insert "previsoes" (toJSON ps) o)
        outro    -> outro

estadoDoCartao :: Cartao -> EstadoCartao
estadoDoCartao c = EstadoCartao (cFacilidade c) (fromIntegral (cIntervalo c)) (cRepeticoes c) (cProximaRevisao c)

-- | Os prazos saem do próprio responder, então a tela mostra o que o SM-2 vai gravar.
previsoesDe :: Day -> Cartao -> [Previsao]
previsoesDe hoje c =
    [ Previsao (notaValor n) (diffDays (proximaRevisao (responder n hoje (estadoDoCartao c))) hoje)
    | n <- mapMaybe mkNota [0 .. 5]
    ]

paraRevisar :: Day -> Cartao -> ParaRevisar
paraRevisar hoje c = ParaRevisar c (previsoesDe hoje c)

instance FromJSON Cartao where
    parseJSON = withObject "Cartao" $ \o -> Cartao
        <$> o .: "id"
        <*> o .: "baralhoId"
        <*> o .: "frente"
        <*> o .: "verso"
        <*> o .: "facilidade"
        <*> o .: "intervalo"
        <*> o .: "repeticoes"
        <*> o .: "proximaRevisao"

{- Os corpos de entrada falham com a mesma mensagem da validação, porque o
formatador de erros do Server devolve o texto do fail ao cliente.
-}
corpo :: (Object -> Parser a) -> Value -> Parser a
corpo p (Object o) = p o
corpo _ _          = fail "o corpo deve ser um objeto JSON"

texto :: Text -> Text -> Object -> Parser Text
texto chave erro o = do
    v <- o .:? K.fromText chave
    case v of
        Just (String t) -> pure t
        _               -> fail (T.unpack erro)

{- | Descrição, cor e padrão são opcionais; sem eles valem o texto vazio e o visual padrão. O PUT
manda o baralho inteiro, então cor ausente na edição volta ao padrão.
-}
instance FromJSON NovoBaralho where
    parseJSON = corpo $ \o -> do
        n <- texto "nome" erroNome o
        d <- o .:? "descricao"
        desc <- case d of
            Nothing         -> pure ""
            Just Null       -> pure ""
            Just (String t) -> pure t
            Just _          -> fail "descricao deve ser texto"
        c <- opcional lerCor "cor" "cor inválida" Cobalto o
        p <- opcional lerPadrao "padrao" "padrão inválido" Liso o
        pure (NovoBaralho n desc (Visual c p))

opcional :: (Text -> Maybe a) -> Key -> Text -> a -> Object -> Parser a
opcional ler chave erro padraoSe o = do
    v <- o .:? chave
    case v of
        Nothing                           -> pure padraoSe
        Just Null                         -> pure padraoSe
        Just (String s) | Just x <- ler s -> pure x
        _                                 -> fail (T.unpack erro)

instance FromJSON NovoCartao where
    parseJSON = corpo $ \o -> NovoCartao
        <$> texto "frente" erroFrente o
        <*> texto "verso" erroVerso o

instance FromJSON Resposta where
    parseJSON = corpo $ \o -> do
        v <- o .:? "nota"
        case v of
            Just (Number n) | Just i <- toBoundedInteger n -> pure (Resposta i)
            _ -> fail (T.unpack erroNota)

obrigatorio :: Text -> Text -> Either Text Text
obrigatorio erro t
    | T.null limpo = Left erro
    | otherwise    = Right limpo
  where
    limpo = T.strip t

validarNovoBaralho :: NovoBaralho -> Either Text NovoBaralho
validarNovoBaralho (NovoBaralho n d v) = NovoBaralho <$> obrigatorio erroNome n <*> pure d <*> pure v

validarNovoCartao :: NovoCartao -> Either Text NovoCartao
validarNovoCartao (NovoCartao f v) =
    NovoCartao <$> obrigatorio erroFrente f <*> obrigatorio erroVerso v

validarResposta :: Resposta -> Either Text Nota
validarResposta (Resposta n) = maybe (Left erroNota) Right (mkNota n)
