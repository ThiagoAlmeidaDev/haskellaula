/* Paleta de comandos (Ctrl K ou Cmd K): busca sem acento em ações e baralhos da conta. Só abre
   com sessão; os itens vêm da API a cada abertura para refletir o que mudou. */
import { baralhos as apiBaralhos } from './api.js';
import { h, plural, semAcento, toast } from './dom.js';
import { pedirNovoBaralho } from './estado.js';
import { sair, usuarioAtual } from './sessao.js';

const dialogo = () => document.querySelector('dialog.paleta');
const LIMITE = 40;

let itens = [];
let visiveis = [];
let ativo = 0;
let origemFoco = null;
let carregamento = 0;

/* Subsequência sem acento e sem caixa: "est port" acha "Estudar Português". Pontua letra seguida
   e início de palavra, para que o nome que começa com a busca suba acima do que só a contém. */
export function pontuar(consulta, texto) {
  const q = semAcento(consulta).replace(/\s+/g, '');
  if (!q) return { pontos: 0, posicoes: [] };
  const alvo = semAcento(texto);
  const posicoes = [];
  let pontos = 0;
  let anterior = -2;
  let j = 0;
  for (let i = 0; i < alvo.length && j < q.length; i += 1) {
    if (alvo[i] !== q[j]) continue;
    pontos += 1;
    if (i === anterior + 1) pontos += 5;
    if (i === 0 || /[\s\-_/·]/.test(alvo[i - 1])) pontos += 8;
    if (anterior >= 0) pontos -= Math.min(3, i - anterior - 1) * 0.5;
    posicoes.push(i);
    anterior = i;
    j += 1;
  }
  return j === q.length ? { pontos, posicoes } : null;
}

function itensBase(baralhos) {
  const lista = [
    { titulo: 'Estudar tudo', detalhe: 'estudo', executar: () => { location.hash = '#/estudar/todos'; }, peso: 2 },
    { titulo: 'Novo baralho', detalhe: 'ação', executar: () => pedirNovoBaralho() },
    { titulo: 'Ir para o início', detalhe: 'navegar', executar: () => { location.hash = '#/'; } },
    { titulo: 'Ir para baralhos', detalhe: 'navegar', executar: () => { location.hash = '#/baralhos'; } },
    { titulo: 'Preferências', detalhe: 'conta', executar: () => { location.hash = '#/preferencias'; } },
  ];
  const fim = [
    { titulo: 'Sair da conta', detalhe: 'conta', executar: () => sair().then(() => { location.hash = '#/entrar'; }, (erro) => toast(erro.message)) },
  ];
  const porPendencia = [...baralhos].sort((a, b) => b.paraHoje - a.paraHoje);
  for (const b of porPendencia) {
    lista.push({
      titulo: `Estudar ${b.nome}`,
      detalhe: b.paraHoje > 0 ? `${b.paraHoje} para hoje` : 'em dia',
      executar: () => { location.hash = `#/estudar/${b.id}`; },
      peso: b.paraHoje > 0 ? 1 : 0,
    });
  }
  for (const b of baralhos) {
    lista.push({ titulo: b.nome, detalhe: plural(b.totalCartoes, 'cartão', 'cartões'), executar: () => { location.hash = `#/baralho/${b.id}`; } });
  }
  for (const b of baralhos) {
    lista.push({ titulo: `Estatísticas de ${b.nome}`, detalhe: 'estatísticas', executar: () => { location.hash = `#/estatisticas/${b.id}`; } });
  }
  return [...lista, ...fim];
}

function tituloRealcado(titulo, posicoes) {
  if (!posicoes.length) return [titulo];
  const marcadas = new Set(posicoes);
  const partes = [];
  let trecho = '';
  let marcado = false;
  for (let i = 0; i < titulo.length; i += 1) {
    const agora = marcadas.has(i);
    if (agora !== marcado && trecho) {
      partes.push(marcado ? h('mark', {}, trecho) : trecho);
      trecho = '';
    }
    marcado = agora;
    trecho += titulo[i];
  }
  if (trecho) partes.push(marcado ? h('mark', {}, trecho) : trecho);
  return partes;
}

function filtrar(consulta) {
  if (!consulta.trim()) {
    return itens.map((item) => ({ item, posicoes: [] })).slice(0, LIMITE);
  }
  return itens
    .map((item, ordem) => {
      const r = pontuar(consulta, item.titulo);
      return r && { item, posicoes: r.posicoes, pontos: r.pontos + (item.peso ?? 0), ordem };
    })
    .filter(Boolean)
    .sort((a, b) => b.pontos - a.pontos || a.ordem - b.ordem)
    .slice(0, LIMITE);
}

function desenhar() {
  const el = dialogo();
  const input = el.querySelector('.paleta-input');
  const lista = el.querySelector('.paleta-lista');
  visiveis = filtrar(input.value);
  ativo = Math.min(ativo, Math.max(0, visiveis.length - 1));

  if (visiveis.length === 0) {
    lista.replaceChildren(h('li', { class: 'paleta-vazio', role: 'presentation' }, 'Nada encontrado'));
    input.removeAttribute('aria-activedescendant');
    return;
  }
  lista.replaceChildren(...visiveis.map(({ item, posicoes }, i) => h('li', {
    class: 'paleta-item', id: `paleta-op-${i}`, role: 'option', 'aria-selected': String(i === ativo),
    onpointermove: () => { if (ativo !== i) marcar(i); },
    onclick: () => executar(i),
  },
  h('span', { class: 'paleta-titulo' }, tituloRealcado(item.titulo, posicoes)),
  h('span', { class: 'paleta-detalhe mono' }, item.detalhe))));
  input.setAttribute('aria-activedescendant', `paleta-op-${ativo}`);
}

function marcar(i) {
  const lista = dialogo().querySelector('.paleta-lista');
  lista.querySelector('[aria-selected="true"]')?.setAttribute('aria-selected', 'false');
  ativo = i;
  const op = document.getElementById(`paleta-op-${i}`);
  op?.setAttribute('aria-selected', 'true');
  op?.scrollIntoView({ block: 'nearest' });
  dialogo().querySelector('.paleta-input').setAttribute('aria-activedescendant', `paleta-op-${i}`);
}

function executar(i) {
  const escolhido = visiveis[i];
  if (!escolhido) return;
  fecharPaleta({ restaurarFoco: false });
  escolhido.item.executar();
}

export function fecharPaleta({ restaurarFoco = true } = {}) {
  const el = dialogo();
  if (!el.open) return;
  el.close();
  if (restaurarFoco && origemFoco instanceof HTMLElement && origemFoco.isConnected) origemFoco.focus();
}

export async function abrirPaleta(consulta = '') {
  const el = dialogo();
  const input = el.querySelector('.paleta-input');
  if (!el.open) {
    origemFoco = document.activeElement;
    el.showModal();
  }
  input.value = consulta;
  ativo = 0;
  itens = itensBase([]);
  desenhar();
  input.focus();

  // Respostas fora de ordem: só a última abertura da paleta pode preencher a lista.
  const minha = ++carregamento;
  try {
    const baralhos = await apiBaralhos.listar();
    if (minha !== carregamento || !el.open) return;
    itens = itensBase(baralhos);
    desenhar();
  } catch (erro) {
    toast(erro.message);
  }
}

export function iniciarPaleta() {
  const el = dialogo();
  const input = el.querySelector('.paleta-input');

  // Ctrl K ou Cmd K funciona até dentro de campos de texto, por isso não passa pelo filtro de digitação.
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      if (!usuarioAtual()) return;
      e.preventDefault();
      if (el.open) fecharPaleta();
      else abrirPaleta();
    }
  });

  input.addEventListener('input', () => { ativo = 0; desenhar(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (visiveis.length) marcar((ativo + 1) % visiveis.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (visiveis.length) marcar((ativo - 1 + visiveis.length) % visiveis.length);
    } else if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      executar(ativo);
    }
  });
  el.addEventListener('cancel', (e) => {
    e.preventDefault();
    fecharPaleta();
  });
  el.addEventListener('click', (e) => {
    if (e.target === el) fecharPaleta();
  });
}

