{- | Núcleo puro do algoritmo SM-2: a nota de 0 a 5 (só existe válida), o estado de
agendamento de um cartão e a função que calcula o próximo estado a partir da resposta.
-}
module Nucleo.SM2
    ( Nota
    , mkNota
    , notaValor
    , EstadoCartao (..)
    , estadoInicial
    , responder
    ) where

import Data.Time (Day, addDays)

-- O construtor fica escondido para que toda Nota em circulação esteja entre 0 e 5.
newtype Nota = Nota Int deriving (Eq, Show)

mkNota :: Int -> Maybe Nota
mkNota n
    | n >= 0 && n <= 5 = Just (Nota n)
    | otherwise        = Nothing

notaValor :: Nota -> Int
notaValor (Nota n) = n

data EstadoCartao = EstadoCartao
    { facilidade     :: Double
    , intervalo      :: Integer
    , repeticoes     :: Int
    , proximaRevisao :: Day
    } deriving (Eq, Show)

estadoInicial :: Day -> EstadoCartao
estadoInicial hoje = EstadoCartao 2.5 0 0 hoje

{- | SM-2 clássico (Wozniak, 1990). A facilidade é recalculada a cada resposta,
inclusive nas erradas, e nunca desce de 1.3. O intervalo é contado a partir de
hoje, não da data agendada, então responder um cartão atrasado não acumula atraso.
-}
responder :: Nota -> Day -> EstadoCartao -> EstadoCartao
responder (Nota q) hoje e = EstadoCartao novaFacilidade novoIntervalo novasRepeticoes (addDays novoIntervalo hoje)
  where
    d = fromIntegral (5 - q)
    novaFacilidade = max 1.3 (facilidade e + (0.1 - d * (0.08 + d * 0.02)))
    novoIntervalo
        | q < 3              = 1
        | repeticoes e == 0  = 1
        | repeticoes e == 1  = 6
        | otherwise          = round (fromInteger (intervalo e) * novaFacilidade)
    novasRepeticoes
        | q < 3     = 0
        | otherwise = repeticoes e + 1
