#!/usr/bin/env bash
# Sobe o Recall em segundo plano toda vez que o Codespace liga (postStartCommand), para que o site
# volte sozinho depois de uma parada por inatividade. A saída do servidor fica em /tmp/recall.log.
set -euo pipefail

# O Main.hs confere o banco na subida e encerra se ele ainda não aceita conexões.
until pg_isready -h localhost -p 5432 -q; do sleep 1; done

# setsid + nohup: o servidor sobrevive ao fim do shell do postStartCommand.
setsid nohup cabal run haskellaula > /tmp/recall.log 2>&1 < /dev/null &
