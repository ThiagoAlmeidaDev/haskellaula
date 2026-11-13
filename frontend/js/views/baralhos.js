/* Todos os baralhos da conta em linhas: busca, ordenação e a gaveta de criar e editar. Criar
   um baralho leva direto à página dele com a gaveta de cartões aberta, o próximo passo natural. */
import { baralhos as apiBaralhos } from '../api.js';
import { h, icone, plural, semAcento, toast, confirmar } from '../dom.js';
import { consumirNovoBaralho, pedirAdicionarCartao } from '../estado.js';
import { abrirGaveta, fecharGaveta } from '../gaveta.js';
import { abortado, estadoErro, esqueleto, campo, mostrarErroCampo, limparErroCampo } from './comum.js';
import { linhaBaralho, capaMini, seletorCor, seletorPadrao } from './componentes.js';

const ORDENS = {
  pendentes: { rotulo: 'Pendentes primeiro', comparar: (a, b) => b.paraHoje - a.paraHoje || a.nome.localeCompare(b.nome, 'pt-BR') },
  nome: { rotulo: 'Nome (A a Z)', comparar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR') },
  recentes: { rotulo: 'Mais recentes', comparar: (a, b) => b.id - a.id },
};

/* Gaveta de baralho: sem baralho cria, com baralho edita. aoExcluir aparece só na edição. */
export function abrirGavetaBaralho({ baralho = null, aoSalvar, aoExcluir } = {}) {
  const nome = h('input', { class: 'input', id: 'baralho-nome', type: 'text', maxlength: '120', autocomplete: 'off', required: true });
  const descricao = h('textarea', { class: 'input', id: 'baralho-descricao', rows: '3', maxlength: '500' });
  nome.value = baralho?.nome ?? '';
  descricao.value = baralho?.descricao ?? '';
  const capa = { cor: baralho?.cor ?? 'cobalto', padrao: baralho?.padrao ?? 'liso' };
  const previa = h('div', { style: 'display: flex; align-items: center; gap: 16px' });
  const desenharPrevia = () => previa.replaceChildren(
    capaMini({ nome: nome.value || 'Baralho', ...capa }),
    h('span', { class: 'campo-ajuda', style: 'margin: 0' }, 'A capa aparece na lista, no painel e no topo de cada carta.'));
  nome.addEventListener('input', () => { limparErroCampo(nome); desenharPrevia(); });
  const padrao = seletorPadrao({ valor: capa.padrao, cor: capa.cor, aoMudar: (v) => { capa.padrao = v; desenharPrevia(); } });
  const cor = seletorCor({ valor: capa.cor, aoMudar: (v) => { capa.cor = v; padrao.mudarCor(v); desenharPrevia(); } });
  desenharPrevia();
  const salvar = h('button', { class: 'btn btn-pri', type: 'submit' }, baralho ? 'Salvar' : 'Criar baralho');

  abrirGaveta({
    titulo: baralho ? 'Editar baralho' : 'Novo baralho',
    corpo: [
      campo({ rotulo: 'Nome', id: nome.id, controle: nome, ajuda: baralho ? null : 'Um assunto por baralho: "Japonês N5", "Anatomia do braço".' }),
      campo({ rotulo: 'Descrição (opcional)', id: descricao.id, controle: descricao }),
      previa,
      cor.el,
      padrao.el,
    ],
    rodape: [
      salvar,
      h('button', { class: 'btn btn-fantasma', type: 'button', onclick: fecharGaveta }, 'Cancelar'),
      baralho && aoExcluir
        ? h('button', { class: 'btn btn-perigo btn-sm', type: 'button', style: 'margin-left: auto', onclick: () => aoExcluir(baralho) }, icone('lixo'), 'Excluir baralho')
        : null,
    ],
    aoEnviar: async () => {
      if (!nome.value.trim()) { mostrarErroCampo(nome, 'Dê um nome ao baralho'); return; }
      salvar.disabled = true;
      try {
        const dados = { nome: nome.value.trim(), descricao: descricao.value.trim(), cor: capa.cor, padrao: capa.padrao };
        const salvo = baralho ? await apiBaralhos.editar(baralho.id, dados) : await apiBaralhos.criar(dados);
        fecharGaveta();
        await aoSalvar?.(salvo);
      } catch (erro) {
        toast(erro.message);
        salvar.disabled = false;
      }
    },
  });
}

export async function confirmarExclusaoBaralho(b) {
  return confirmar({
    titulo: `Excluir “${b.nome}”?`,
    texto: b.totalCartoes > 0
      ? `${plural(b.totalCartoes, 'cartão', 'cartões')} e todo o histórico de revisões serão apagados. Não dá para desfazer.`
      : 'O baralho está vazio.',
    acao: 'Excluir baralho',
  });
}

export async function renderBaralhos(main, _params, { signal }) {
  document.title = 'Baralhos · Recall';
  const contagem = h('p', { class: 'subtitulo' });
  const busca = h('input', { class: 'input', type: 'search', placeholder: 'Buscar baralho', 'aria-label': 'Buscar baralho' });
  const ordem = h('select', { class: 'input', 'aria-label': 'Ordenar baralhos' },
    Object.entries(ORDENS).map(([valor, o]) => h('option', { value: valor }, o.rotulo)));
  const lista = h('ul', { class: 'lista ficha', 'aria-busy': 'true' }, esqueleto('esq-card', 3).map((e) => h('li', {}, e)));
  const novo = h('button', { class: 'btn btn-pri', type: 'button', onclick: () => abrirNovo() }, icone('mais'), 'Novo baralho');

  main.append(h('div', { class: 'pagina' },
    h('header', { class: 'cabeca' },
      h('div', { class: 'cabeca-texto' },
        h('h1', { class: 'titulo', tabindex: '-1' }, 'Baralhos'),
        contagem),
      h('div', { class: 'cabeca-acoes' }, novo)),
    h('div', { class: 'barra-ferramentas' },
      h('label', { class: 'busca' }, icone('busca'), busca),
      ordem),
    lista));

  let todos = [];

  function desenhar({ focarId } = {}) {
    lista.removeAttribute('aria-busy');
    const totalCartoes = todos.reduce((s, b) => s + b.totalCartoes, 0);
    contagem.textContent = todos.length
      ? `${plural(todos.length, 'baralho', 'baralhos')} e ${plural(totalCartoes, 'cartão', 'cartões')}`
      : 'Comece criando um baralho para um assunto que você quer guardar.';

    if (todos.length === 0) {
      lista.replaceChildren(h('li', { class: 'estado vazio' },
        h('p', { class: 'estado-titulo' }, 'Nenhum baralho ainda'),
        h('p', { class: 'estado-texto' }, 'Crie um baralho e escreva os primeiros cartões. Eles entram na revisão de hoje.'),
        h('div', { class: 'estado-acoes' },
          h('button', { class: 'btn btn-pri', type: 'button', onclick: () => abrirNovo() }, icone('mais'), 'Criar o primeiro baralho'))));
      return;
    }

    const termo = semAcento(busca.value.trim());
    const visiveis = todos
      .filter((b) => !termo || semAcento(`${b.nome} ${b.descricao}`).includes(termo))
      .sort(ORDENS[ordem.value].comparar);
    if (visiveis.length === 0) {
      lista.replaceChildren(h('li', { class: 'estado vazio' },
        h('p', { class: 'estado-titulo' }, 'Nenhum baralho com esse nome'),
        h('div', { class: 'estado-acoes' },
          h('button', { class: 'btn btn-sec', type: 'button', onclick: () => { busca.value = ''; desenhar(); busca.focus(); } }, 'Limpar busca'))));
      return;
    }
    lista.replaceChildren(...visiveis.map((b) => linhaBaralho(b, { aoEditar: editar, aoExcluir: excluir })));
    if (focarId) {
      const linha = lista.querySelector(`[data-id="${focarId}"]`);
      linha?.classList.add('recem-criado');
      linha?.querySelector('a')?.focus();
    }
  }

  async function carregar(opcoes) {
    try {
      todos = await apiBaralhos.listar({ signal });
      desenhar(opcoes);
    } catch (erro) {
      if (!abortado(erro)) estadoErro(main, erro);
    }
  }

  function abrirNovo() {
    abrirGavetaBaralho({
      aoSalvar: (criado) => {
        pedirAdicionarCartao();
        location.hash = `#/baralho/${criado.id}`;
      },
    });
  }

  function editar(b) {
    abrirGavetaBaralho({
      baralho: b,
      aoSalvar: (salvo) => carregar({ focarId: salvo.id }),
      aoExcluir: (alvo) => { fecharGaveta(); excluir(alvo); },
    });
  }

  async function excluir(b) {
    if (!(await confirmarExclusaoBaralho(b))) return;
    try {
      await apiBaralhos.excluir(b.id);
      toast(`“${b.nome}” foi excluído.`, { tipo: 'ok' });
      await carregar();
    } catch (erro) {
      toast(erro.message);
    }
  }

  busca.addEventListener('input', () => desenhar());
  ordem.addEventListener('change', () => desenhar());
  const aoPedirNovo = () => abrirNovo();
  window.addEventListener('recall:novo-baralho', aoPedirNovo);

  await carregar();
  if (consumirNovoBaralho()) abrirNovo();
  return () => {
    window.removeEventListener('recall:novo-baralho', aoPedirNovo);
    document.title = 'Recall';
  };
}
