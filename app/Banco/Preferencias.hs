{-# LANGUAGE OverloadedStrings #-}

{- | Leitura e gravação das preferências de estudo da conta. Quem nunca salvou recebe o padrão
de Nucleo.Preferencias, sem que nada seja gravado. Salvar substitui a linha inteira com um único
UPSERT.
-}
module Banco.Preferencias
    ( buscarPreferencias
    , salvarPreferencias
    ) where

import Control.Exception (throwIO)
import Data.Text (Text)
import Database.PostgreSQL.Simple

import Nucleo.Preferencias

type LinhaPreferencias = (Int, Int, Bool, Text, Text, Text, Bool)

colunas :: Query
colunas = "tamanho_pergunta, tamanho_resposta, mostrar_pergunta, revelar, fonte, tema, embaralhar"

{- Os CHECK do schema só deixam gravar valores conhecidos. Se aparecer um texto que não dá para
ler, o banco está fora do schema, e a consulta falha em vez de inventar um valor.
-}
paraPreferencias :: LinhaPreferencias -> IO Preferencias
paraPreferencias (tamPergunta, tamResposta, manterPergunta, textoRevelar, textoFonte, textoTema, embaralharCartoes) =
    case (lerRevelar textoRevelar, lerFonte textoFonte, lerTema textoTema) of
        (Just revelarLido, Just fonteLida, Just temaLido) ->
            pure (Preferencias tamPergunta tamResposta manterPergunta revelarLido fonteLida temaLido embaralharCartoes)
        _ -> throwIO (userError ("preferências fora do schema: " ++ show (textoRevelar, textoFonte, textoTema)))

buscarPreferencias :: Connection -> Int -> IO Preferencias
buscarPreferencias conn idUsuario = do
    linhas <- query conn ("SELECT " <> colunas <> " FROM preferencias WHERE usuario_id = ?") (Only idUsuario)
    case linhas of
        [linha] -> paraPreferencias linha
        _       -> pure preferenciasPadrao

salvarPreferencias :: Connection -> Int -> Preferencias -> IO Preferencias
salvarPreferencias conn idUsuario prefs = do
    linhas <- query conn
        ("INSERT INTO preferencias (usuario_id, " <> colunas <> ") VALUES (?, ?, ?, ?, ?, ?, ?, ?) \
         \ON CONFLICT (usuario_id) DO UPDATE SET tamanho_pergunta = EXCLUDED.tamanho_pergunta, \
         \tamanho_resposta = EXCLUDED.tamanho_resposta, mostrar_pergunta = EXCLUDED.mostrar_pergunta, \
         \revelar = EXCLUDED.revelar, fonte = EXCLUDED.fonte, tema = EXCLUDED.tema, embaralhar = EXCLUDED.embaralhar \
         \RETURNING " <> colunas)
        ( (idUsuario, tamanhoPergunta prefs, tamanhoResposta prefs, mostrarPergunta prefs)
        :. (revelarTexto (revelar prefs), fonteTexto (fonte prefs), temaTexto (tema prefs), embaralhar prefs) )
    case linhas of
        [linha] -> paraPreferencias linha
        _       -> throwIO (userError "salvarPreferencias: o banco não devolveu exatamente uma linha")
