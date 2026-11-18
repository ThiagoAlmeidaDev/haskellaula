/* Peças visuais repetidas entre as telas: a capa do baralho, a barra de domínio, a etiqueta de
   etapa, a linha de baralho, os controles de escolha (cor, estampa, opções, chave, tamanho) e a
   carta de estudo que segue as preferências de tamanho, fonte e jeito de revelar. */
import { h, icone } from '../dom.js';

export const CORES = [
  { valor: 'cobalto', nome: 'Cobalto' },
  { valor: 'tomate', nome: 'Tomate' },
  { valor: 'sol', nome: 'Sol' },
  { valor: 'hortela', nome: 'Hortelã' },
  { valor: 'chiclete', nome: 'Chiclete' },
  { valor: 'ceu', nome: 'Céu' },
  { valor: 'terra', nome: 'Terra' },
  { valor: 'grafite', nome: 'Grafite' },
];

export const PADROES = [
  { valor: 'liso', nome: 'Liso' },
  { valor: 'bolinhas', nome: 'Bolinhas' },
  { valor: 'listras', nome: 'Listras' },
  { valor: 'xadrez', nome: 'Xadrez' },
];

/* Tamanho em pixels de cada passo, de 1 a 8, das preferências. A resposta fica um pouco menor que a pergunta. */
const TAMANHO_PERGUNTA = [20, 26, 32, 40, 50, 60, 72, 86];
const TAMANHO_RESPOSTA = [17, 21, 26, 32, 40, 48, 58, 70];
export const TAMANHO_MAXIMO = TAMANHO_PERGUNTA.length;

const NOMES_ETAPA = { novo: 'Novo', aprendendo: 'Aprendendo', dominado: 'Dominado' };

export function etapaChip(etapa) {
  return h('span', { class: `etapa etapa-${etapa}` }, NOMES_ETAPA[etapa] ?? etapa);
}

export function capaMini(baralho) {
  const inicial = ([...(baralho.nome ?? '').trim()][0] ?? '?').toLocaleUpperCase('pt-BR');
  return h('span', { class: 'capa capa-mini', dataset: { cor: baralho.cor ?? 'cobalto', padrao: baralho.padrao ?? 'liso' }, 'aria-hidden': 'true' }, inicial);
}

export function barraDominio(etapas, { grande = false } = {}) {
  const total = etapas.novos + etapas.aprendendo + etapas.dominados;
  const largura = (quantidade) => `width: ${total ? Math.round((quantidade / total) * 1000) / 10 : 0}%`;
  return h('div', {
    class: grande ? 'dominio dominio-grande' : 'dominio', role: 'img',
    'aria-label': total
      ? `${etapas.dominados} dominados, ${etapas.aprendendo} aprendendo e ${etapas.novos} novos`
      : 'Nenhum cartão',
  },
  h('span', { class: 'd-dominado', style: largura(etapas.dominados) }),
  h('span', { class: 'd-aprendendo', style: largura(etapas.aprendendo) }),
  h('span', { class: 'd-novo', style: largura(etapas.novos) }));
}

export function legendaDominio(etapas) {
  const item = (classe, quantidade, rotulo) => h('span', { class: 'legenda-item' },
    h('span', { class: `ponto ${classe}` }), h('strong', {}, String(quantidade)), rotulo);
  return h('div', { class: 'legenda' },
    item('ponto-dominado', etapas.dominados, etapas.dominados === 1 ? 'dominado' : 'dominados'),
    item('ponto-aprendendo', etapas.aprendendo, 'aprendendo'),
    item('ponto-novo', etapas.novos, etapas.novos === 1 ? 'novo' : 'novos'));
}

// As etapas que existem no baralho, em texto, na mesma ordem e cor da barra.
function resumoEtapas(etapas) {
  const partes = [];
  if (etapas.dominados) partes.push(`${etapas.dominados} ${etapas.dominados === 1 ? 'dominado' : 'dominados'}`);
  if (etapas.aprendendo) partes.push(`${etapas.aprendendo} aprendendo`);
  if (etapas.novos) partes.push(`${etapas.novos} ${etapas.novos === 1 ? 'novo' : 'novos'}`);
  return partes.join(', ');
}

/* Linha de baralho: capa, nome que leva à página, domínio, pendência e ações sempre visíveis. */
export function linhaBaralho(baralho, { aoEditar, aoExcluir } = {}) {
  return h('li', { class: 'linha-baralho', dataset: { id: baralho.id } },
    capaMini(baralho),
    h('div', { class: 'lb-texto' },
      h('a', { class: 'lb-nome', href: `#/baralho/${baralho.id}` }, baralho.nome),
      baralho.descricao ? h('p', { class: 'lb-desc' }, baralho.descricao) : null),
    h('div', { class: 'lb-dominio' },
      barraDominio(baralho.etapas),
      h('span', { class: 'mono' }, baralho.totalCartoes ? resumoEtapas(baralho.etapas) : 'sem cartões')),
    h('div', { class: 'lb-pendencia' },
      baralho.paraHoje > 0
        ? h('span', { class: 'pendencia' }, `${baralho.paraHoje} para hoje`)
        : h('span', { class: 'em-dia' }, baralho.totalCartoes ? 'Em dia' : 'Vazio')),
    h('div', { class: 'lb-acoes' },
      baralho.paraHoje > 0 ? h('a', { class: 'btn btn-sec btn-sm', href: `#/estudar/${baralho.id}` }, 'Estudar') : null,
      aoEditar ? h('button', { class: 'btn-icone', type: 'button', title: 'Editar baralho', 'aria-label': `Editar baralho ${baralho.nome}`, onclick: () => aoEditar(baralho) }, icone('lapis')) : null,
      aoExcluir ? h('button', { class: 'btn-icone perigo', type: 'button', title: 'Excluir baralho', 'aria-label': `Excluir baralho ${baralho.nome}`, onclick: () => aoExcluir(baralho) }, icone('lixo')) : null,
      h('a', { class: 'btn-icone', href: `#/baralho/${baralho.id}`, title: 'Abrir baralho', 'aria-label': `Abrir baralho ${baralho.nome}` }, icone('seta'))));
}

let contadorGrupos = 0;

/* Grupo de botões de rádio com a aparência que cada controle pede. Devolve o fieldset e as funções para mudar e ler o valor. */
function grupoRadios({ legenda, nome, itens, valor, classeGrupo, montarItem, aoMudar }) {
  const id = `${nome}-${(contadorGrupos += 1)}`;
  const entradas = itens.map((item) => {
    const input = h('input', { type: 'radio', name: id, value: item.valor, 'aria-label': item.nome });
    input.checked = item.valor === valor;
    input.addEventListener('change', () => { if (input.checked) aoMudar?.(item.valor); });
    return montarItem(item, input);
  });
  const el = h('fieldset', { class: 'campo', style: 'border: 0; margin: 0; padding: 0; min-width: 0' },
    h('legend', { class: 'campo-rotulo', style: 'padding: 0' }, legenda),
    h('div', { class: classeGrupo }, entradas));
  return {
    el,
    definir(novo) { for (const radio of el.querySelectorAll('input')) radio.checked = radio.value === novo; },
    valor() { return el.querySelector('input:checked')?.value; },
  };
}

export function seletorCor({ valor = 'cobalto', aoMudar, legenda = 'Cor da capa' } = {}) {
  return grupoRadios({
    legenda, nome: 'cor', itens: CORES, valor, classeGrupo: 'amostras', aoMudar,
    montarItem: (item, input) => h('label', { class: 'amostra capa', dataset: { cor: item.valor }, title: item.nome }, input),
  });
}

export function seletorPadrao({ valor = 'liso', cor = 'cobalto', aoMudar, legenda = 'Estampa' } = {}) {
  const grupo = grupoRadios({
    legenda, nome: 'padrao', itens: PADROES, valor, classeGrupo: 'amostras', aoMudar,
    montarItem: (item, input) => h('label', { class: 'amostra estampa capa', dataset: { cor, padrao: item.valor }, title: item.nome }, input),
  });
  grupo.mudarCor = (novaCor) => { for (const amostra of grupo.el.querySelectorAll('.amostra')) amostra.dataset.cor = novaCor; };
  return grupo;
}

export function seletorOpcoes({ legenda, nome, itens, valor, aoMudar }) {
  return grupoRadios({
    legenda, nome, itens, valor, classeGrupo: 'opcoes', aoMudar,
    montarItem: (item, input) => h('label', { class: 'opcao', style: item.estilo ?? '' }, input, item.rotulo ?? item.nome),
  });
}

export function chave({ rotulo, valor, aoMudar }) {
  const input = h('input', { type: 'checkbox', role: 'switch' });
  input.checked = Boolean(valor);
  input.addEventListener('change', () => aoMudar?.(input.checked));
  return { el: h('label', { class: 'chave' }, h('span', {}, rotulo), input, h('span', { class: 'chave-trilho', 'aria-hidden': 'true' })), input };
}

export function faixaTamanho({ rotulo, valor, aoMudar }) {
  const numero = h('span', { class: 'mono', 'aria-hidden': 'true' }, String(valor));
  const input = h('input', { type: 'range', min: '1', max: String(TAMANHO_MAXIMO), step: '1', value: String(valor), 'aria-label': rotulo });
  input.addEventListener('input', () => { numero.textContent = input.value; aoMudar?.(Number(input.value)); });
  return {
    el: h('div', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, rotulo), h('div', { class: 'faixa-tamanho' }, h('span', { 'aria-hidden': 'true' }, 'A'), input, h('span', { 'aria-hidden': 'true', style: 'font-size: 22px; font-weight: 800' }, 'A'), numero)),
    definir(novo) { input.value = String(novo); numero.textContent = String(novo); },
  };
}

/* A carta de estudo. "virar" gira a carta e mostra o verso; "abaixo" mantém a frente e põe a
   resposta embaixo. Sem mostrarPergunta, a pergunta some quando a resposta aparece. */
export function cartaEstudo({ pergunta, resposta, rotuloEsq = '', rotuloDir = '', cor = 'cobalto', padrao = 'liso', prefs }) {
  let atuais = prefs;
  let revelada = false;
  const faixa = () => h('header', { class: 'carta-faixa capa', dataset: { cor, padrao } }, h('span', {}, rotuloEsq), h('span', {}, rotuloDir));
  const perguntaFrente = h('p', { class: 'carta-pergunta' }, pergunta);
  const perguntaVerso = h('p', { class: 'carta-pergunta pequena' }, pergunta);
  const respostaVerso = h('p', { class: 'carta-resposta' }, resposta);
  const corte = h('div', { class: 'carta-corte', 'aria-hidden': 'true' });
  const respostaAbaixo = h('p', { class: 'carta-resposta aparece' }, resposta);
  const miolo = h('div', { class: 'carta-miolo' }, perguntaFrente);
  const frente = h('div', { class: 'carta-face carta-frente' }, faixa(), miolo);
  const verso = h('div', { class: 'carta-face carta-verso', 'aria-hidden': 'true' }, faixa(), h('div', { class: 'carta-miolo' }, perguntaVerso, respostaVerso));
  const carta = h('article', { class: 'carta-estudo' }, frente, verso);
  const el = h('div', { class: 'carta-palco' }, carta);

  function esconder() {
    revelada = false;
    carta.classList.remove('virada');
    frente.removeAttribute('aria-hidden');
    verso.setAttribute('aria-hidden', 'true');
    corte.remove();
    respostaAbaixo.remove();
    perguntaFrente.hidden = false;
  }

  function revelar() {
    revelada = true;
    if (atuais.revelar === 'virar') {
      carta.classList.add('virada');
      frente.setAttribute('aria-hidden', 'true');
      verso.removeAttribute('aria-hidden');
      perguntaVerso.hidden = !atuais.mostrarPergunta;
    } else {
      perguntaFrente.hidden = !atuais.mostrarPergunta;
      miolo.append(...(atuais.mostrarPergunta ? [corte] : []), respostaAbaixo);
    }
  }

  function aplicar(novas) {
    atuais = novas;
    el.dataset.revelar = novas.revelar;
    el.dataset.fonte = novas.fonte;
    el.style.setProperty('--tam-p', `${TAMANHO_PERGUNTA[novas.tamanhoPergunta - 1]}px`);
    el.style.setProperty('--tam-r', `${TAMANHO_RESPOSTA[novas.tamanhoResposta - 1]}px`);
    if (revelada) { esconder(); revelar(); }
  }

  function capa(novaCor, novoPadrao) {
    for (const elementoFaixa of el.querySelectorAll('.carta-faixa')) { elementoFaixa.dataset.cor = novaCor; elementoFaixa.dataset.padrao = novoPadrao; }
  }

  aplicar(prefs);
  return {
    el, carta, revelar, esconder, aplicar, capa,
    get revelada() { return revelada; },
    alternar() { if (revelada) esconder(); else revelar(); },
  };
}
