{-# LANGUAGE OverloadedStrings #-}

{- | Núcleo puro dos números: as estatísticas de um baralho e o resumo de estudo da conta
(revisões de hoje, sequência de dias, atividade recente e os próximos dias de revisão).
Recebe "hoje" como argumento.
-}
module Nucleo.Stats
    ( Estatisticas (..)
    , calcularEstatisticas
    , Agendado (..)
    , Proximo (..)
    , Resumo (..)
    , calcularResumo
    ) where

import Data.Aeson (ToJSON (..), Value, object, (.=))
import Data.List (sortOn)
import qualified Data.Set as Set
import Data.Text (Text)
import Data.Time (Day, addDays)

import Nucleo.Types (Cartao (..))

data Estatisticas = Estatisticas
    { eTotal          :: Int
    , eParaHoje       :: Int
    , eTotalRevisoes  :: Int
    , eTaxaAcerto     :: Double
    , ePrevisao       :: [(Day, Int)]
    , eDificeis       :: [Cartao]
    , eRevisoesPorDia :: [(Day, Int)]
    } deriving (Eq, Show)

-- Revisões e acertos somados juntos, numa passada só pelo foldMap.
data Placar = Placar Int Int

instance Semigroup Placar where
    Placar r a <> Placar r' a' = Placar (r + r') (a + a')

instance Monoid Placar where
    mempty = Placar 0 0

placar :: Int -> Placar
placar n
    | n >= 3    = Placar 1 1
    | otherwise = Placar 1 0

{- | Recebe hoje, os cartões do baralho e as revisões como (dia local, nota).
Atrasados entram no dia de hoje da previsão, que vai de hoje a hoje+6; a janela
de revisões vai de hoje-29 a hoje, com zero nos dias sem revisão. Acerto é nota
3 ou mais, a mesma fronteira do SM-2. Difíceis: facilidade abaixo de 2.0, as 5
menores, empate pelo id.
-}
calcularEstatisticas :: Day -> [Cartao] -> [(Day, Int)] -> Estatisticas
calcularEstatisticas hoje cartoes notas = Estatisticas
    { eTotal          = length cartoes
    , eParaHoje       = length [c | c <- cartoes, cProximaRevisao c <= hoje]
    , eTotalRevisoes  = revisoes
    , eTaxaAcerto     = taxa
    , ePrevisao       = [(d, length [c | c <- cartoes, diaPrevisto c == d]) | d <- dias 0 6]
    , eDificeis       = take 5 (sortOn (\c -> (cFacilidade c, cartaoId c)) [c | c <- cartoes, cFacilidade c < 2.0])
    , eRevisoesPorDia = [(d, length [n | (d', n) <- notas, d' == d]) | d <- dias (-29) 0]
    }
  where
    Placar revisoes acertos = foldMap (placar . snd) notas
    taxa
        | revisoes == 0 = 0
        | otherwise     = fromIntegral acertos / fromIntegral revisoes
    diaPrevisto c = max hoje (cProximaRevisao c)
    dias de ate = [addDays i hoje | i <- [de .. ate]]

diaQuantidade :: (Day, Int) -> Value
diaQuantidade (d, q) = object ["dia" .= d, "quantidade" .= q]

instance ToJSON Estatisticas where
    toJSON e = object
        [ "total"          .= eTotal e
        , "paraHoje"       .= eParaHoje e
        , "totalRevisoes"  .= eTotalRevisoes e
        , "taxaAcerto"     .= eTaxaAcerto e
        , "previsao"       .= map diaQuantidade (ePrevisao e)
        , "dificeis"       .= eDificeis e
        , "revisoesPorDia" .= map diaQuantidade (eRevisoesPorDia e)
        ]

-- | Quantos cartões de um baralho estão agendados para um dia.
data Agendado = Agendado
    { agDia        :: Day
    , agBaralhoId  :: Int
    , agBaralho    :: Text
    , agQuantidade :: Int
    } deriving (Eq, Show)

-- | Um dia da agenda: o total e os baralhos que voltam nele.
data Proximo = Proximo
    { pxDia        :: Day
    , pxQuantidade :: Int
    , pxBaralhos   :: [Agendado]
    } deriving (Eq, Show)

data Resumo = Resumo
    { resRevisoesHoje :: Int
    , resSequencia    :: Int
    , resAtividade    :: [(Day, Int)]
    , resProximos     :: [Proximo]
    } deriving (Eq, Show)

{- | Recebe hoje, o dia local de cada revisão da conta e os cartões agendados por dia e baralho.
A sequência conta os dias seguidos com ao menos uma revisão; enquanto hoje não tem revisão ela
parte de ontem, para não zerar antes de o dia acabar. A atividade vai de hoje-13 a hoje e os
próximos de amanhã a hoje+14, os dois com zero nos dias vazios. Hoje e os atrasados ficam fora
dos próximos: são o "para hoje". No dia, o baralho com mais cartões vem antes; empate pelo nome.
-}
calcularResumo :: Day -> [Day] -> [Agendado] -> Resumo
calcularResumo hoje revisoes agenda = Resumo
    { resRevisoesHoje = length (filter (== hoje) revisoes)
    , resSequencia    = length (takeWhile (`Set.member` dias) [addDays (negate i) inicio | i <- [0 ..]])
    , resAtividade    = [(d, length (filter (== d) revisoes)) | d <- [addDays i hoje | i <- [-13 .. 0]]]
    , resProximos     = map proximo [addDays i hoje | i <- [1 .. 14]]
    }
  where
    dias = Set.fromList revisoes
    inicio
        | Set.member hoje dias = hoje
        | otherwise            = addDays (-1) hoje
    proximo d =
        let doDia = sortOn (\a -> (negate (agQuantidade a), agBaralho a)) [a | a <- agenda, agDia a == d]
        in Proximo d (sum (map agQuantidade doDia)) doDia

instance ToJSON Resumo where
    toJSON r = object
        [ "revisoesHoje" .= resRevisoesHoje r
        , "sequencia"    .= resSequencia r
        , "atividade"    .= map diaQuantidade (resAtividade r)
        , "proximos"     .= resProximos r
        ]

instance ToJSON Proximo where
    toJSON p = object
        [ "dia"        .= pxDia p
        , "quantidade" .= pxQuantidade p
        , "baralhos"   .= [object ["id" .= agBaralhoId a, "nome" .= agBaralho a, "quantidade" .= agQuantidade a] | a <- pxBaralhos p]
        ]
