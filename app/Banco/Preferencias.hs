{-# LANGUAGE OverloadedStrings #-}

{- | Leitura e gravação das preferências de estudo da conta. Quem nunca salvou recebe o padrão de
Nucleo.Preferencias sem gravar nada; salvar substitui a linha inteira num único UPSERT.
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

-- Os CHECK do schema só deixam gravar valores conhecidos; texto que não se lê é banco fora do schema.
paraPreferencias :: LinhaPreferencias -> IO Preferencias
paraPreferencias (tp, tr, mp, r, f, t, e) =
    case (lerRevelar r, lerFonte f, lerTema t) of
        (Just r', Just f', Just t') -> pure (Preferencias tp tr mp r' f' t' e)
        _ -> throwIO (userError ("preferências fora do schema: " ++ show (r, f, t)))

buscarPreferencias :: Connection -> Int -> IO Preferencias
buscarPreferencias conn uid = do
    linhas <- query conn ("SELECT " <> colunas <> " FROM preferencias WHERE usuario_id = ?") (Only uid)
    case linhas of
        [linha] -> paraPreferencias linha
        _       -> pure preferenciasPadrao

salvarPreferencias :: Connection -> Int -> Preferencias -> IO Preferencias
salvarPreferencias conn uid p = do
    linhas <- query conn
        ("INSERT INTO preferencias (usuario_id, " <> colunas <> ") VALUES (?, ?, ?, ?, ?, ?, ?, ?) \
         \ON CONFLICT (usuario_id) DO UPDATE SET tamanho_pergunta = EXCLUDED.tamanho_pergunta, \
         \tamanho_resposta = EXCLUDED.tamanho_resposta, mostrar_pergunta = EXCLUDED.mostrar_pergunta, \
         \revelar = EXCLUDED.revelar, fonte = EXCLUDED.fonte, tema = EXCLUDED.tema, embaralhar = EXCLUDED.embaralhar \
         \RETURNING " <> colunas)
        ( (uid, tamanhoPergunta p, tamanhoResposta p, mostrarPergunta p)
        :. (revelarTexto (revelar p), fonteTexto (fonte p), temaTexto (tema p), embaralhar p) )
    case linhas of
        [linha] -> paraPreferencias linha
        _       -> throwIO (userError "salvarPreferencias: o banco não devolveu exatamente uma linha")
