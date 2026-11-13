/* Cliente da API: toda chamada passa por api(), que lança Error com o "erro" do JSON quando a
   resposta não é 2xx. O cookie de sessão é HttpOnly e vai sozinho; um 401 fora das rotas de
   conta avisa o app (evento recall:sem-sessao) para levar a pessoa ao login. */

const ROTAS_DE_CONTA = ['/api/sessao', '/api/contas'];

export async function api(method, path, body, { signal } = {}) {
  const opcoes = { method, signal, headers: { Accept: 'application/json' }, credentials: 'same-origin' };
  if (body !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(body);
  }

  let resposta;
  try {
    resposta = await fetch(path, opcoes);
  } catch (erro) {
    if (erro.name === 'AbortError') throw erro;
    throw new Error('Sem conexão com o servidor');
  }

  if (resposta.status === 204) return null;

  const texto = await resposta.text();
  let dados = null;
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      if (resposta.ok) throw new Error(`Resposta inválida do servidor em ${path}`);
    }
  }

  if (!resposta.ok) {
    if (resposta.status === 401 && !ROTAS_DE_CONTA.includes(path)) {
      window.dispatchEvent(new CustomEvent('recall:sem-sessao'));
    }
    const erro = new Error(dados?.erro ?? `Erro ${resposta.status} em ${method} ${path}`);
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

export const conta = {
  atual: (opts) => api('GET', '/api/sessao', undefined, opts),
  entrar: (dados) => api('POST', '/api/sessao', dados),
  criar: (dados) => api('POST', '/api/contas', dados),
  sair: () => api('DELETE', '/api/sessao'),
  resumo: (opts) => api('GET', '/api/resumo', undefined, opts),
  preferencias: (opts) => api('GET', '/api/preferencias', undefined, opts),
  salvarPreferencias: (dados) => api('PUT', '/api/preferencias', dados),
};

export const baralhos = {
  listar: (opts) => api('GET', '/api/baralhos', undefined, opts),
  buscar: (id, opts) => api('GET', `/api/baralhos/${id}`, undefined, opts),
  criar: (dados) => api('POST', '/api/baralhos', dados),
  editar: (id, dados) => api('PUT', `/api/baralhos/${id}`, dados),
  excluir: (id) => api('DELETE', `/api/baralhos/${id}`),
  cartoes: (id, opts) => api('GET', `/api/baralhos/${id}/cartoes`, undefined, opts),
  criarCartao: (id, dados) => api('POST', `/api/baralhos/${id}/cartoes`, dados),
  revisar: (id, opts) => api('GET', `/api/baralhos/${id}/revisar`, undefined, opts),
  revisarTudo: (opts) => api('GET', '/api/revisar', undefined, opts),
  estatisticas: (id, opts) => api('GET', `/api/baralhos/${id}/estatisticas`, undefined, opts),
};

export const cartoes = {
  editar: (id, dados) => api('PUT', `/api/cartoes/${id}`, dados),
  excluir: (id) => api('DELETE', `/api/cartoes/${id}`),
  responder: (id, nota) => api('POST', `/api/cartoes/${id}/responder`, { nota }),
};
