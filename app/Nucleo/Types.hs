{-# LANGUAGE OverloadedStrings #-}

{- | Os registros da API (baralho, cartão e resposta), com o JSON de entrada e saída e a validação
que roda antes de qualquer IO. Também calcula a etapa de cada cartão e o prazo que cada nota daria
na revisão. As mensagens de erro de corpo inválido são definidas aqui.

Os campos dos registros têm o nome do tipo como prefixo (cartaoFacilidade, novoBaralhoNome...)
porque em Haskell cada campo vira uma função do módulo, e dois tipos não podem ter um campo com
o mesmo nome.
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
corTexto corDaCapa = case corDaCapa of
    Cobalto  -> "cobalto"
    Tomate   -> "tomate"
    Sol      -> "sol"
    Hortela  -> "hortela"
    Chiclete -> "chiclete"
    Ceu      -> "ceu"
    Terra    -> "terra"
    Grafite  -> "grafite"

padraoTexto :: Padrao -> Text
padraoTexto estampa = case estampa of
    Liso     -> "liso"
    Bolinhas -> "bolinhas"
    Listras  -> "listras"
    Xadrez   -> "xadrez"

lerCor :: Text -> Maybe Cor
lerCor textoCor = lookup textoCor [(corTexto opcao, opcao) | opcao <- [minBound .. maxBound]]

lerPadrao :: Text -> Maybe Padrao
lerPadrao textoPadrao = lookup textoPadrao [(padraoTexto opcao, opcao) | opcao <- [minBound .. maxBound]]

data Etapa = Novo | Aprendendo | Dominado deriving (Eq, Show)

data Etapas = Etapas
    { novos      :: Int
    , aprendendo :: Int
    , dominados  :: Int
    } deriving (Eq, Show)

semEtapas :: Etapas
semEtapas = Etapas 0 0 0

{- | Recebe as repetições e o intervalo do cartão. Novo é o cartão que nunca foi respondido, e
dominado é o que tem intervalo de 21 dias ou mais (o mesmo limite que o Anki usa para cartão
maduro). Todo o resto, inclusive um cartão que acabou de ser errado, está aprendendo.
-}
etapaDe :: Int -> Int -> Etapa
etapaDe numeroRepeticoes diasIntervalo
    | numeroRepeticoes == 0 && diasIntervalo == 0 = Novo
    | diasIntervalo >= 21                         = Dominado
    | otherwise                                   = Aprendendo

-- | Conta as etapas a partir de pares (repetições, intervalo).
contarEtapas :: [(Int, Int)] -> Etapas
contarEtapas = foldr somar semEtapas
  where
    somar (numeroRepeticoes, diasIntervalo) (Etapas qtdNovos qtdAprendendo qtdDominados) =
        case etapaDe numeroRepeticoes diasIntervalo of
            Novo       -> Etapas (qtdNovos + 1) qtdAprendendo qtdDominados
            Aprendendo -> Etapas qtdNovos (qtdAprendendo + 1) qtdDominados
            Dominado   -> Etapas qtdNovos qtdAprendendo (qtdDominados + 1)

data NovoBaralho = NovoBaralho
    { novoBaralhoNome      :: Text
    , novoBaralhoDescricao :: Text
    , novoBaralhoVisual    :: Visual
    } deriving (Eq, Show)

data Cartao = Cartao
    { cartaoId             :: Int
    , cartaoBaralhoId      :: Int
    , frente               :: Text
    , verso                :: Text
    , cartaoFacilidade     :: Double
    , cartaoIntervalo      :: Int
    , cartaoRepeticoes     :: Int
    , cartaoProximaRevisao :: Day
    } deriving (Eq, Show)

data NovoCartao = NovoCartao
    { novoCartaoFrente :: Text
    , novoCartaoVerso  :: Text
    } deriving (Eq, Show)

newtype Resposta = Resposta { respostaNota :: Int } deriving (Eq, Show)

erroNome, erroFrente, erroVerso, erroNota :: Text
erroNome   = "nome é obrigatório"
erroFrente = "frente é obrigatória"
erroVerso  = "verso é obrigatório"
erroNota   = "nota deve estar entre 0 e 5"

instance ToJSON Baralho where
    toJSON baralho = object
        [ "id"           .= baralhoId baralho
        , "nome"         .= nome baralho
        , "descricao"    .= descricao baralho
        , "totalCartoes" .= totalCartoes baralho
        , "paraHoje"     .= paraHoje baralho
        , "etapas"       .= etapas baralho
        , "cor"          .= corTexto (cor (visual baralho))
        , "padrao"       .= padraoTexto (padrao (visual baralho))
        ]

instance ToJSON Etapas where
    toJSON contagem = object
        [ "novos"      .= novos contagem
        , "aprendendo" .= aprendendo contagem
        , "dominados"  .= dominados contagem
        ]

instance ToJSON Etapa where
    toJSON Novo       = String "novo"
    toJSON Aprendendo = String "aprendendo"
    toJSON Dominado   = String "dominado"

instance ToJSON Cartao where
    toJSON cartao = object
        [ "id"             .= cartaoId cartao
        , "baralhoId"      .= cartaoBaralhoId cartao
        , "frente"         .= frente cartao
        , "verso"          .= verso cartao
        , "facilidade"     .= cartaoFacilidade cartao
        , "intervalo"      .= cartaoIntervalo cartao
        , "repeticoes"     .= cartaoRepeticoes cartao
        , "proximaRevisao" .= cartaoProximaRevisao cartao
        , "etapa"          .= etapaDe (cartaoRepeticoes cartao) (cartaoIntervalo cartao)
        ]

-- | Em quantos dias o cartão voltaria se a resposta de hoje fosse esta nota.
data Previsao = Previsao Int Integer deriving (Eq, Show)

-- | Um cartão que vence hoje, junto com a previsão de cada nota, que a tela de estudo mostra nos botões.
data ParaRevisar = ParaRevisar Cartao [Previsao] deriving (Eq, Show)

instance ToJSON Previsao where
    toJSON (Previsao valorNota dias) = object ["nota" .= valorNota, "dias" .= dias]

-- O cartão sai com as mesmas chaves de sempre e mais a lista de previsões.
instance ToJSON ParaRevisar where
    toJSON (ParaRevisar cartao previsoes) = case toJSON cartao of
        Object chaves -> Object (KM.insert "previsoes" (toJSON previsoes) chaves)
        outro         -> outro

estadoDoCartao :: Cartao -> EstadoCartao
estadoDoCartao cartao =
    EstadoCartao (cartaoFacilidade cartao) (fromIntegral (cartaoIntervalo cartao)) (cartaoRepeticoes cartao) (cartaoProximaRevisao cartao)

-- | As previsões usam a própria função responder, então a tela mostra exatamente o que o SM-2 vai gravar.
previsoesDe :: Day -> Cartao -> [Previsao]
previsoesDe hoje cartao =
    [ Previsao (notaValor nota) (diffDays (proximaRevisao (responder nota hoje (estadoDoCartao cartao))) hoje)
    | nota <- mapMaybe mkNota [0 .. 5]
    ]

paraRevisar :: Day -> Cartao -> ParaRevisar
paraRevisar hoje cartao = ParaRevisar cartao (previsoesDe hoje cartao)

instance FromJSON Cartao where
    parseJSON = withObject "Cartao" $ \objeto -> Cartao
        <$> objeto .: "id"
        <*> objeto .: "baralhoId"
        <*> objeto .: "frente"
        <*> objeto .: "verso"
        <*> objeto .: "facilidade"
        <*> objeto .: "intervalo"
        <*> objeto .: "repeticoes"
        <*> objeto .: "proximaRevisao"

{- Os corpos de entrada falham com a mesma mensagem da validação, porque o formatador de erros do
Web.Server devolve ao cliente o texto passado para o fail.
-}
corpo :: (Object -> Parser a) -> Value -> Parser a
corpo lerObjeto (Object objeto) = lerObjeto objeto
corpo _ _                       = fail "o corpo deve ser um objeto JSON"

texto :: Text -> Text -> Object -> Parser Text
texto chave erro objeto = do
    valor <- objeto .:? K.fromText chave
    case valor of
        Just (String conteudo) -> pure conteudo
        _                      -> fail (T.unpack erro)

{- | Descrição, cor e padrão são opcionais. Sem eles, valem o texto vazio e o visual padrão. Como o
PUT manda o baralho inteiro, uma edição sem cor volta para a cor padrão.
-}
instance FromJSON NovoBaralho where
    parseJSON = corpo $ \objeto -> do
        nomeBaralho <- texto "nome" erroNome objeto
        descricaoRecebida <- objeto .:? "descricao"
        descricaoBaralho <- case descricaoRecebida of
            Nothing                -> pure ""
            Just Null              -> pure ""
            Just (String conteudo) -> pure conteudo
            Just _                 -> fail "descricao deve ser texto"
        corBaralho <- opcional lerCor "cor" "cor inválida" Cobalto objeto
        padraoBaralho <- opcional lerPadrao "padrao" "padrão inválido" Liso objeto
        pure (NovoBaralho nomeBaralho descricaoBaralho (Visual corBaralho padraoBaralho))

opcional :: (Text -> Maybe a) -> Key -> Text -> a -> Object -> Parser a
opcional ler chave erro valorPadrao objeto = do
    valor <- objeto .:? chave
    case valor of
        Nothing                                         -> pure valorPadrao
        Just Null                                       -> pure valorPadrao
        Just (String conteudo) | Just lido <- ler conteudo -> pure lido
        _                                               -> fail (T.unpack erro)

instance FromJSON NovoCartao where
    parseJSON = corpo $ \objeto -> NovoCartao
        <$> texto "frente" erroFrente objeto
        <*> texto "verso" erroVerso objeto

instance FromJSON Resposta where
    parseJSON = corpo $ \objeto -> do
        valor <- objeto .:? "nota"
        case valor of
            Just (Number numero) | Just inteiro <- toBoundedInteger numero -> pure (Resposta inteiro)
            _ -> fail (T.unpack erroNota)

obrigatorio :: Text -> Text -> Either Text Text
obrigatorio erro conteudo
    | T.null limpo = Left erro
    | otherwise    = Right limpo
  where
    limpo = T.strip conteudo

validarNovoBaralho :: NovoBaralho -> Either Text NovoBaralho
validarNovoBaralho (NovoBaralho nomeBaralho descricaoBaralho visualBaralho) =
    NovoBaralho <$> obrigatorio erroNome nomeBaralho <*> pure descricaoBaralho <*> pure visualBaralho

validarNovoCartao :: NovoCartao -> Either Text NovoCartao
validarNovoCartao (NovoCartao frenteCartao versoCartao) =
    NovoCartao <$> obrigatorio erroFrente frenteCartao <*> obrigatorio erroVerso versoCartao

validarResposta :: Resposta -> Either Text Nota
validarResposta (Resposta valor) = maybe (Left erroNota) Right (mkNota valor)
