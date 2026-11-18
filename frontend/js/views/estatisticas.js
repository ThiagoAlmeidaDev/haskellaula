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

function tileAcerto(estatisticas) {
  if (estatisticas.totalRevisoes === 0) {
    return tile('—', 'Taxa de acerto', h('p', { class: 'stat-nota mono' }, 'sem revisões'));
  }
  const porcentagem = Math.round(estatisticas.taxaAcerto * 100);
  return tile(`${porcentagem}%`, 'Taxa de acerto',
    h('div', { class: 'medidor', role: 'meter', 'aria-label': 'Taxa de acerto', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(porcentagem) },
      h('span', { class: 'medidor-valor', style: `width: ${porcentagem}%` })));
}

function listaDificeis(dificeis) {
  if (dificeis.length === 0) {
    return h('p', { class: 'vazio-inline' }, 'Nenhum cartão com facilidade abaixo de 2,00.');
  }
  return h('ol', { class: 'dificeis' }, dificeis.map((cartao) => h('li', { class: 'dificil' },
    h('div', { class: 'dificil-texto' },
      h('p', { class: 'dificil-frente' }, cartao.frente),
      h('p', { class: 'dificil-verso' }, cartao.verso)),
    h('div', { class: 'dificil-meta mono' },
      h('span', {}, `facilidade ${decimal.format(cartao.facilidade)}`),
      h('span', { class: 'suave' }, quandoRevisar(cartao.proximaRevisao))))));
}

export async function renderEstatisticas(main, { id }, { signal }) {
  main.append(h('div', { class: 'pagina', 'aria-busy': 'true' },
    esqueleto('esq-titulo', 1),
    h('div', { class: 'stats' }, esqueleto('esq-stat', 4)),
    h('div', { class: 'paineis' }, esqueleto('esq-painel', 2))));

  let baralho;
  let estatisticas;
  try {
    [baralho, estatisticas] = await Promise.all([
      apiBaralhos.buscar(id, { signal }),
      apiBaralhos.estatisticas(id, { signal }),
    ]);
  } catch (erro) {
    if (!abortado(erro)) estadoErro(main, erro);
    return;
  }
  document.title = `Estatísticas de ${baralho.nome} · Recall`;

  const previsao = graficoPrevisao(estatisticas.previsao);
  const atrasadosHoje = estatisticas.previsao[0]?.quantidade ?? 0;

  main.replaceChildren(h('div', { class: 'pagina' },
    voltar(`#/baralho/${id}`, 'Baralho'),
    h('header', { class: 'cabeca' },
      h('div', { class: 'cabeca-texto' },
        h('p', { class: 'eyebrow' }, baralho.nome),
        h('h1', { class: 'titulo', tabindex: '-1' }, 'Estatísticas')),
      estatisticas.paraHoje > 0
        ? h('div', { class: 'cabeca-acoes' },
          h('a', { class: 'btn btn-pri', href: `#/estudar/${id}` }, 'Estudar', h('span', { class: 'btn-contagem' }, String(estatisticas.paraHoje))))
        : null),
    h('div', { class: 'stats' },
      tile(formatarNumero(estatisticas.total), estatisticas.total === 1 ? 'Cartão' : 'Cartões'),
      tile(formatarNumero(estatisticas.paraHoje), 'Para hoje'),
      tileAcerto(estatisticas),
      tile(formatarNumero(estatisticas.totalRevisoes), estatisticas.totalRevisoes === 1 ? 'Revisão' : 'Revisões')),
    h('div', { class: 'paineis' },
      h('section', { class: 'painel tecla', 'aria-labelledby': 'titulo-previsao' },
        h('h2', { class: 'painel-titulo', id: 'titulo-previsao' }, 'Próximos 7 dias'),
        h('p', { class: 'painel-sub' }, atrasadosHoje > 0
          ? 'Cartões agendados por dia. Hoje inclui os atrasados.'
          : 'Cartões agendados por dia.'),
        previsao.el),
      h('section', { class: 'painel tecla', 'aria-labelledby': 'titulo-heatmap' },
        h('h2', { class: 'painel-titulo', id: 'titulo-heatmap' }, 'Últimos 30 dias'),
        heatmapRevisoes(estatisticas.revisoesPorDia))),
    h('section', { class: 'painel tecla', 'aria-labelledby': 'titulo-dificeis' },
      h('h2', { class: 'painel-titulo', id: 'titulo-dificeis' }, 'Cartões difíceis'),
      h('p', { class: 'painel-sub' }, 'Os que você mais erra: facilidade abaixo de 2,00, numa escala que começa em 2,50 e desce até 1,30.'),
      listaDificeis(estatisticas.dificeis))));

  return () => {
    previsao.desligar();
    document.title = 'Recall';
  };
}
