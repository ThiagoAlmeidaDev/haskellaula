# GHC 9.10.3 sobre Debian 12. libpq-dev traz a libpq e o pg_config que o postgresql-libpq usa
# para compilar; o cliente psql serve para consultar o banco pelo terminal (e o pg_isready, para
# esperar o banco antes de subir o servidor). tzdata deixa o TZ do devcontainer.json valer: o
# "hoje" do servidor é o dia local, e em UTC as revisões virariam às 21h no Brasil.
FROM haskell:9.10.3-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev pkg-config postgresql-client tzdata \
    && rm -rf /var/lib/apt/lists/*
