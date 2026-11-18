{- | O algoritmo SM-2. Define a nota de 0 a 5 (que só pode ser criada com um valor válido), o
estado de agendamento de um cartão e a função que calcula o próximo estado depois de uma resposta.
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

-- O construtor não é exportado, então toda Nota que existe no programa está entre 0 e 5.
newtype Nota = Nota Int deriving (Eq, Show)

mkNota :: Int -> Maybe Nota
mkNota valor
    | valor >= 0 && valor <= 5 = Just (Nota valor)
    | otherwise                = Nothing

notaValor :: Nota -> Int
notaValor (Nota valor) = valor

data EstadoCartao = EstadoCartao
    { facilidade     :: Double
    , intervalo      :: Integer
    , repeticoes     :: Int
    , proximaRevisao :: Day
    } deriving (Eq, Show)

estadoInicial :: Day -> EstadoCartao
estadoInicial hoje = EstadoCartao 2.5 0 0 hoje

{- | SM-2 clássico (Wozniak, 1990). A facilidade é recalculada em toda resposta, inclusive nas
erradas, e nunca fica abaixo de 1.3. O intervalo é contado a partir de hoje, e não da data que
estava agendada, para que responder um cartão atrasado não acumule o atraso.
-}
responder :: Nota -> Day -> EstadoCartao -> EstadoCartao
responder (Nota nota) hoje estado = EstadoCartao novaFacilidade novoIntervalo novasRepeticoes (addDays novoIntervalo hoje)
  where
    -- Quanto a nota ficou abaixo da máxima: 0 para nota 5, 5 para nota 0.
    distanciaDoMaximo = fromIntegral (5 - nota)
    novaFacilidade = max 1.3 (facilidade estado + (0.1 - distanciaDoMaximo * (0.08 + distanciaDoMaximo * 0.02)))
    novoIntervalo
        | nota < 3                = 1
        | repeticoes estado == 0  = 1
        | repeticoes estado == 1  = 6
        | otherwise               = round (fromInteger (intervalo estado) * novaFacilidade)
    novasRepeticoes
        | nota < 3  = 0
        | otherwise = repeticoes estado + 1
