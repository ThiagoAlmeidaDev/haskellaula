{-# LANGUAGE DataKinds #-}
{-# LANGUAGE TypeOperators #-}

{- | O contrato HTTP: rotas públicas de conta e sessão, rotas da conta (exigem o cookie de
sessão) e o Raw que serve o frontend. O tipo é a documentação das rotas.
-}
module Web.Api
    ( API
    , RotasPublicas
    , RotasDaConta
    , ComCookie
    , api
    ) where

import Data.Aeson (Value)
import Data.Text (Text)
import Servant

import Nucleo.Conta (Credenciais, NovaConta, Usuario)
import Nucleo.Preferencias (Preferencias)
import Nucleo.Stats (Estatisticas, Resumo)
import Nucleo.Types

type Excluir = Verb 'DELETE 204 '[JSON] NoContent

type ComCookie a = Headers '[Header "Set-Cookie" Text] a

type RotasPublicas =
         "saude" :> Get '[JSON] Value
    :<|> "contas" :> ReqBody '[JSON] NovaConta :> PostCreated '[JSON] (ComCookie Usuario)
    :<|> "sessao" :> ReqBody '[JSON] Credenciais :> Post '[JSON] (ComCookie Usuario)
    :<|> "sessao" :> Header "Cookie" Text :> Get '[JSON] (Maybe Usuario)
    :<|> "sessao" :> Header "Cookie" Text :> Verb 'DELETE 204 '[JSON] (ComCookie NoContent)

type RotasDaConta =
         "resumo" :> Get '[JSON] Resumo
    :<|> "preferencias" :> Get '[JSON] Preferencias
    :<|> "preferencias" :> ReqBody '[JSON] Preferencias :> Put '[JSON] Preferencias
    :<|> "baralhos" :> Get '[JSON] [Baralho]
    :<|> "baralhos" :> ReqBody '[JSON] NovoBaralho :> PostCreated '[JSON] Baralho
    :<|> "baralhos" :> Capture "id" Int :> Get '[JSON] Baralho
    :<|> "baralhos" :> Capture "id" Int :> ReqBody '[JSON] NovoBaralho :> Put '[JSON] Baralho
    :<|> "baralhos" :> Capture "id" Int :> Excluir
    :<|> "baralhos" :> Capture "id" Int :> "cartoes" :> Get '[JSON] [Cartao]
    :<|> "baralhos" :> Capture "id" Int :> "cartoes" :> ReqBody '[JSON] NovoCartao :> PostCreated '[JSON] Cartao
    :<|> "baralhos" :> Capture "id" Int :> "revisar" :> Get '[JSON] [ParaRevisar]
    :<|> "revisar" :> Get '[JSON] [ParaRevisar]
    :<|> "baralhos" :> Capture "id" Int :> "estatisticas" :> Get '[JSON] Estatisticas
    :<|> "cartoes" :> Capture "id" Int :> ReqBody '[JSON] NovoCartao :> Put '[JSON] Cartao
    :<|> "cartoes" :> Capture "id" Int :> Excluir
    :<|> "cartoes" :> Capture "id" Int :> "responder" :> ReqBody '[JSON] Resposta :> Post '[JSON] Cartao

type API = "api" :> (RotasPublicas :<|> Header "Cookie" Text :> RotasDaConta) :<|> Raw

api :: Proxy API
api = Proxy
