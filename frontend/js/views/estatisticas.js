/* Estatísticas de um baralho: números da conta do baralho, previsão de 7 dias, mapa dos
   últimos 30 dias e os cartões de menor facilidade. Os números vêm prontos da API. */
import { baralhos as apiBaralhos } from '../api.js';
import { h, formatarNumero, quandoRevisar } from '../dom.js';
import { graficoPrevisao, heatmapRevisoes } from '../graficos.js';
import { abortado, estadoErro, voltar, esqueleto } from './comum.js';

const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function tile(valor, rotulo, extra) {
  return h('div', { class: 'stat tecla' },
    h('p', { class: 'stat-valor' }, valor),
    h('p', { class: 'stat-rotulo' }, rotulo),
    extra ?? null);
}

function tileAcerto(e) {
  if (e.totalRevisoes === 0) {
    return tile('—', 'Taxa de acerto', h('p', { class: 'stat-nota mono' }, 'sem revisões'));
  }
  const pct = Math.round(e.taxaAcerto * 100);
  return tile(`${pct}%`, 'Taxa de acerto',
    h('div', { class: 'medidor', role: 'meter', 'aria-label': 'Taxa de acerto', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) },
      h('span', { class: 'medidor-valor', style: `width: ${pct}%` })));
}

function listaDificeis(dificeis) {
  if (dificeis.length === 0) {
    return h('p', { class: 'vazio-inline' }, 'Nenhum cartão com facilidade abaixo de 2,00.');
  }
  return h('ol', { class: 'dificeis' }, dificeis.map((c) => h('li', { class: 'dificil' },
    h('div', { class: 'dificil-texto' },
      h('p', { class: 'dificil-frente' }, c.frente),
      h('p', { class: 'dificil-verso' }, c.verso)),
    h('div', { class: 'dificil-meta mono' },
      h('span', {}, `facilidade ${decimal.format(c.facilidade)}`),
      h('span', { class: 'suave' }, quandoRevisar(c.proximaRevisao))))));
}

export async function renderEstatisticas(main, { id }, { signal }) {
  main.append(h('div', { class: 'pagina', 'aria-busy': 'true' },
    esqueleto('esq-titulo', 1),
    h('div', { class: 'stats' }, esqueleto('esq-stat', 4)),
    h('div', { class: 'paineis' }, esqueleto('esq-painel', 2))));

  let baralho;
  let e;
  try {
    [baralho, e] = await Promise.all([
      apiBaralhos.buscar(id, { signal }),
      apiBaralhos.estatisticas(id, { signal }),
    ]);
  } catch (erro) {
    if (!abortado(erro)) estadoErro(main, erro);
    return;
  }
  document.title = `Estatísticas de ${baralho.nome} · Recall`;

  const previsao = graficoPrevisao(e.previsao);
  const atrasadosHoje = e.previsao[0]?.quantidade ?? 0;

  main.replaceChildren(h('div', { class: 'pagina' },
    voltar(`#/baralho/${id}`, 'Baralho'),
    h('header', { class: 'cabeca' },
      h('div', { class: 'cabeca-texto' },
        h('p', { class: 'eyebrow' }, baralho.nome),
        h('h1', { class: 'titulo', tabindex: '-1' }, 'Estatísticas')),
      e.paraHoje > 0
        ? h('div', { class: 'cabeca-acoes' },
          h('a', { class: 'btn btn-pri', href: `#/estudar/${id}` }, 'Estudar', h('span', { class: 'btn-contagem' }, String(e.paraHoje))))
        : null),
    h('div', { class: 'stats' },
      tile(formatarNumero(e.total), e.total === 1 ? 'Cartão' : 'Cartões'),
      tile(formatarNumero(e.paraHoje), 'Para hoje'),
      tileAcerto(e),
      tile(formatarNumero(e.totalRevisoes), e.totalRevisoes === 1 ? 'Revisão' : 'Revisões')),
    h('div', { class: 'paineis' },
      h('section', { class: 'painel tecla', 'aria-labelledby': 'titulo-previsao' },
        h('h2', { class: 'painel-titulo', id: 'titulo-previsao' }, 'Próximos 7 dias'),
        h('p', { class: 'painel-sub' }, atrasadosHoje > 0
          ? 'Cartões agendados por dia. Hoje inclui os atrasados.'
          : 'Cartões agendados por dia.'),
        previsao.el),
      h('section', { class: 'painel tecla', 'aria-labelledby': 'titulo-heatmap' },
        h('h2', { class: 'painel-titulo', id: 'titulo-heatmap' }, 'Últimos 30 dias'),
        heatmapRevisoes(e.revisoesPorDia))),
    h('section', { class: 'painel tecla', 'aria-labelledby': 'titulo-dificeis' },
      h('h2', { class: 'painel-titulo', id: 'titulo-dificeis' }, 'Cartões difíceis'),
      h('p', { class: 'painel-sub' }, 'Os que você mais erra: facilidade abaixo de 2,00, numa escala que começa em 2,50 e desce até 1,30.'),
      listaDificeis(e.dificeis))));

  return () => {
    previsao.desligar();
    document.title = 'Recall';
  };
}
