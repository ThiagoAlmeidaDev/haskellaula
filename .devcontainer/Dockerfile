# GHC 9.10.3 sobre Debian 12. libpq-dev traz a libpq e o pg_config que o postgresql-libpq usa
# para compilar; o cliente psql serve para consultar o banco pelo terminal.
FROM haskell:9.10.3-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev pkg-config postgresql-client \
    && rm -rf /var/lib/apt/lists/*
