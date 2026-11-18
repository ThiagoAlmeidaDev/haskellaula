{-# LANGUAGE OverloadedStrings #-}

{- | Os números do app: as estatísticas de um baralho e o resumo de estudo da conta (revisões de
hoje, sequência de dias, atividade recente e os próximos dias de revisão). Como o resto do
Nucleo, recebe "hoje" como argumento em vez de ler o relógio.
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
    { estatisticasTotal          :: Int
    , estatisticasParaHoje       :: Int
    , estatisticasTotalRevisoes  :: Int
    , estatisticasTaxaAcerto     :: Double
    , estatisticasPrevisao       :: [(Day, Int)]
    , estatisticasDificeis       :: [Cartao]
    , estatisticasRevisoesPorDia :: [(Day, Int)]
    } deriving (Eq, Show)

-- Guarda o total de revisões e o de acertos, para somar os dois numa passada só com foldMap.
data Placar = Placar Int Int

instance Semigroup Placar where
    Placar revisoes acertos <> Placar outrasRevisoes outrosAcertos =
        Placar (revisoes + outrasRevisoes) (acertos + outrosAcertos)

instance Monoid Placar where
    mempty = Placar 0 0

placar :: Int -> Placar
placar nota
    | nota >= 3 = Placar 1 1
    | otherwise = Placar 1 0

{- | Recebe hoje, os cartões do baralho e as revisões como pares (dia local, nota).

A previsão vai de hoje até hoje+6, e os cartões atrasados entram no dia de hoje. As revisões por
dia cobrem de hoje-29 até hoje, com zero nos dias sem revisão. Conta como acerto a nota 3 ou
mais, o mesmo limite do SM-2. Os difíceis são os 5 cartões com facilidade mais baixa entre os que
estão abaixo de 2.0, desempatados pelo id.
-}
calcularEstatisticas :: Day -> [Cartao] -> [(Day, Int)] -> Estatisticas
calcularEstatisticas hoje cartoes notas = Estatisticas
    { estatisticasTotal          = length cartoes
    , estatisticasParaHoje       = length [cartao | cartao <- cartoes, cartaoProximaRevisao cartao <= hoje]
    , estatisticasTotalRevisoes  = totalRevisoes
    , estatisticasTaxaAcerto     = taxa
    , estatisticasPrevisao       = [(dia, length [cartao | cartao <- cartoes, diaPrevisto cartao == dia]) | dia <- dias 0 6]
    , estatisticasDificeis       = take 5 (sortOn (\cartao -> (cartaoFacilidade cartao, cartaoId cartao)) [cartao | cartao <- cartoes, cartaoFacilidade cartao < 2.0])
    , estatisticasRevisoesPorDia = [(dia, length [nota | (diaDaNota, nota) <- notas, diaDaNota == dia]) | dia <- dias (-29) 0]
    }
  where
    Placar totalRevisoes totalAcertos = foldMap (placar . snd) notas
    taxa
        | totalRevisoes == 0 = 0
        | otherwise          = fromIntegral totalAcertos / fromIntegral totalRevisoes
    diaPrevisto cartao = max hoje (cartaoProximaRevisao cartao)
    dias inicio fim = [addDays deslocamento hoje | deslocamento <- [inicio .. fim]]

diaQuantidade :: (Day, Int) -> Value
diaQuantidade (dia, quantidade) = object ["dia" .= dia, "quantidade" .= quantidade]

instance ToJSON Estatisticas where
    toJSON estatisticas = object
        [ "total"          .= estatisticasTotal estatisticas
        , "paraHoje"       .= estatisticasParaHoje estatisticas
        , "totalRevisoes"  .= estatisticasTotalRevisoes estatisticas
        , "taxaAcerto"     .= estatisticasTaxaAcerto estatisticas
        , "previsao"       .= map diaQuantidade (estatisticasPrevisao estatisticas)
        , "dificeis"       .= estatisticasDificeis estatisticas
        , "revisoesPorDia" .= map diaQuantidade (estatisticasRevisoesPorDia estatisticas)
        ]

-- | Quantos cartões de um baralho estão agendados para um dia.
data Agendado = Agendado
    { agendadoDia        :: Day
    , agendadoBaralhoId  :: Int
    , agendadoBaralho    :: Text
    , agendadoQuantidade :: Int
    } deriving (Eq, Show)

-- | Um dia da agenda: o total de cartões e os baralhos que voltam nele.
data Proximo = Proximo
    { proximoDia        :: Day
    , proximoQuantidade :: Int
    , proximoBaralhos   :: [Agendado]
    } deriving (Eq, Show)

data Resumo = Resumo
    { resumoRevisoesHoje :: Int
    , resumoSequencia    :: Int
    , resumoAtividade    :: [(Day, Int)]
    , resumoProximos     :: [Proximo]
    } deriving (Eq, Show)

{- | Recebe hoje, o dia local de cada revisão da conta e os cartões agendados por dia e baralho.

A sequência conta quantos dias seguidos tiveram pelo menos uma revisão. Enquanto não houver
revisão hoje, a contagem começa de ontem, para a sequência não zerar antes do fim do dia. A
atividade vai de hoje-13 até hoje, e os próximos dias vão de amanhã até hoje+14, os dois com zero
nos dias vazios. Os cartões de hoje e os atrasados não entram nos próximos dias, porque já
aparecem como "para hoje". Dentro de cada dia, o baralho com mais cartões vem primeiro, e o
empate é resolvido pelo nome.
-}
calcularResumo :: Day -> [Day] -> [Agendado] -> Resumo
calcularResumo hoje revisoes agenda = Resumo
    { resumoRevisoesHoje = length (filter (== hoje) revisoes)
    , resumoSequencia    = length (takeWhile (`Set.member` diasComRevisao) [addDays (negate atras) inicio | atras <- [0 ..]])
    , resumoAtividade    = [(dia, length (filter (== dia) revisoes)) | dia <- [addDays deslocamento hoje | deslocamento <- [-13 .. 0]]]
    , resumoProximos     = map proximo [addDays deslocamento hoje | deslocamento <- [1 .. 14]]
    }
  where
    diasComRevisao = Set.fromList revisoes
    inicio
        | Set.member hoje diasComRevisao = hoje
        | otherwise                      = addDays (-1) hoje
    proximo dia =
        let doDia = sortOn (\agendado -> (negate (agendadoQuantidade agendado), agendadoBaralho agendado))
                           [agendado | agendado <- agenda, agendadoDia agendado == dia]
        in Proximo dia (sum (map agendadoQuantidade doDia)) doDia

instance ToJSON Resumo where
    toJSON resumo = object
        [ "revisoesHoje" .= resumoRevisoesHoje resumo
        , "sequencia"    .= resumoSequencia resumo
        , "atividade"    .= map diaQuantidade (resumoAtividade resumo)
        , "proximos"     .= resumoProximos resumo
        ]

instance ToJSON Proximo where
    toJSON diaDaAgenda = object
        [ "dia"        .= proximoDia diaDaAgenda
        , "quantidade" .= proximoQuantidade diaDaAgenda
        , "baralhos"   .= [ object [ "id" .= agendadoBaralhoId agendado
                                   , "nome" .= agendadoBaralho agendado
                                   , "quantidade" .= agendadoQuantidade agendado ]
                          | agendado <- proximoBaralhos diaDaAgenda ]
        ]
