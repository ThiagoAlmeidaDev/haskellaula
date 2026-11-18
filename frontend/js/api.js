/* Cliente da API. Toda chamada passa por api(), que lança um Error com o campo "erro" do JSON
   quando a resposta não é 2xx. O cookie de sessão é HttpOnly e vai sozinho. Um 401 fora das
   rotas de conta dispara o evento recall:sem-sessao, para o app mandar a pessoa para o login. */

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
  atual: (opcoes) => api('GET', '/api/sessao', undefined, opcoes),
  entrar: (dados) => api('POST', '/api/sessao', dados),
  criar: (dados) => api('POST', '/api/contas', dados),
  sair: () => api('DELETE', '/api/sessao'),
  resumo: (opcoes) => api('GET', '/api/resumo', undefined, opcoes),
  preferencias: (opcoes) => api('GET', '/api/preferencias', undefined, opcoes),
  salvarPreferencias: (dados) => api('PUT', '/api/preferencias', dados),
};

export const baralhos = {
  listar: (opcoes) => api('GET', '/api/baralhos', undefined, opcoes),
  buscar: (id, opcoes) => api('GET', `/api/baralhos/${id}`, undefined, opcoes),
  criar: (dados) => api('POST', '/api/baralhos', dados),
  editar: (id, dados) => api('PUT', `/api/baralhos/${id}`, dados),
  excluir: (id) => api('DELETE', `/api/baralhos/${id}`),
  cartoes: (id, opcoes) => api('GET', `/api/baralhos/${id}/cartoes`, undefined, opcoes),
  criarCartao: (id, dados) => api('POST', `/api/baralhos/${id}/cartoes`, dados),
  revisar: (id, opcoes) => api('GET', `/api/baralhos/${id}/revisar`, undefined, opcoes),
  revisarTudo: (opcoes) => api('GET', '/api/revisar', undefined, opcoes),
  estatisticas: (id, opcoes) => api('GET', `/api/baralhos/${id}/estatisticas`, undefined, opcoes),
};

export const cartoes = {
  editar: (id, dados) => api('PUT', `/api/cartoes/${id}`, dados),
  excluir: (id) => api('DELETE', `/api/cartoes/${id}`),
  responder: (id, nota) => api('POST', `/api/cartoes/${id}/responder`, { nota }),
};
