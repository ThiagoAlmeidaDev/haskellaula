/* Gráficos em SVG próprio, sem biblioteca: barras da previsão (redesenhadas na largura real
   pelo ResizeObserver) e o mapa de calor das revisões, ambos com tabela de dados acessível. */
import { h, svg, plural, diaCurto, diaDaSemana, lerDia, formatarNumero } from './dom.js';

function tetoLimpo(maximo) {
  if (maximo <= 4) return 4;
  const passo = 10 ** Math.floor(Math.log10(maximo));
  for (const fator of [1, 2, 2.5, 5, 10]) {
    if (fator * passo >= maximo) return fator * passo;
  }
  return 10 * passo;
}

// Barra com o topo arredondado e a base reta, apoiada na linha de base.
function caminhoBarra(x, y, largura, altura) {
  const raio = Math.min(4, largura / 2, altura);
  if (altura <= 0) return '';
  return `M${x},${y + altura}V${y + raio}Q${x},${y} ${x + raio},${y}H${x + largura - raio}Q${x + largura},${y} ${x + largura},${y + raio}V${y + altura}Z`;
}

function criarTooltip(container) {
  const dica = h('div', { class: 'grafico-dica', role: 'presentation', hidden: true },
    h('strong', { class: 'grafico-dica-valor' }), h('span', { class: 'grafico-dica-rotulo' }));
  container.append(dica);
  return {
    mostrar(valor, rotulo, alvo) {
      dica.querySelector('strong').textContent = valor;
      dica.querySelector('span').textContent = rotulo;
      dica.hidden = false;
      const caixa = container.getBoundingClientRect();
      const caixaAlvo = alvo.getBoundingClientRect();
      const meio = caixaAlvo.left + caixaAlvo.width / 2 - caixa.left;
      const largura = dica.offsetWidth;
      const x = Math.max(0, Math.min(caixa.width - largura, meio - largura / 2));
      dica.style.transform = `translate(${x}px, ${caixaAlvo.top - caixa.top - dica.offsetHeight - 8}px)`;
    },
    esconder() { dica.hidden = true; },
  };
}

function tabelaDados(legenda, cabecalhos, linhas) {
  return h('details', { class: 'tabela-dados' },
    h('summary', {}, 'Ver dados'),
    h('table', {},
      h('caption', { class: 'sr-only' }, legenda),
      h('thead', {}, h('tr', {}, cabecalhos.map((cabecalho) => h('th', { scope: 'col' }, cabecalho)))),
      h('tbody', {}, linhas.map((linha) => h('tr', {}, linha.map((celula, i) => (i === 0 ? h('th', { scope: 'row' }, celula) : h('td', {}, celula))))))));
}

export function graficoPrevisao(previsao) {
  const area = h('div', { class: 'grafico-area' });
  const dica = criarTooltip(area);
  const maximo = Math.max(0, ...previsao.map((ponto) => ponto.quantidade));
  const teto = tetoLimpo(maximo);
  const indiceMaximo = previsao.findIndex((ponto) => ponto.quantidade === maximo);

  function desenhar(largura) {
    const altura = 200;
    const margem = { topo: 20, direita: 4, base: 36, esquerda: 28 };
    const larguraUtil = largura - margem.esquerda - margem.direita;
    const alturaUtil = altura - margem.topo - margem.base;
    const banda = larguraUtil / previsao.length;
    const larguraBarra = Math.min(24, banda * 0.56);
    const escala = (valor) => (valor / teto) * alturaUtil;
    const marcas = teto % 2 === 0 ? [0, teto / 2, teto] : [0, teto];

    const desenho = svg('svg', {
      class: 'grafico-svg', width: largura, height: altura, viewBox: `0 0 ${largura} ${altura}`,
      role: 'img', 'aria-label': `Cartões agendados nos próximos 7 dias: ${previsao.map((ponto, i) => `${i === 0 ? 'hoje' : diaCurto(ponto.dia)} ${ponto.quantidade}`).join(', ')}`,
    });

    for (const marca of marcas) {
      const y = margem.topo + alturaUtil - escala(marca) + 0.5;
      desenho.append(
        svg('line', { class: marca === 0 ? 'eixo-base' : 'eixo-grade', x1: margem.esquerda, x2: largura - margem.direita, y1: y, y2: y }),
        svg('text', { class: 'eixo-texto', x: margem.esquerda - 8, y: y + 4, 'text-anchor': 'end' }, formatarNumero(marca)));
    }

    previsao.forEach((ponto, i) => {
      const centro = margem.esquerda + banda * i + banda / 2;
      const alturaBarra = escala(ponto.quantidade);
      const y = margem.topo + alturaUtil - alturaBarra;
      const rotuloDia = i === 0 ? 'hoje' : `${diaDaSemana(ponto.dia)} ${diaCurto(ponto.dia)}`;
      const grupo = svg('g', { class: i === 0 ? 'barra-grupo barra-hoje' : 'barra-grupo' },
        svg('rect', { class: 'barra-alvo', x: centro - banda / 2, y: margem.topo, width: banda, height: alturaUtil + margem.base }),
        svg('path', { class: 'barra-marca', d: caminhoBarra(centro - larguraBarra / 2, y, larguraBarra, alturaBarra) }),
        svg('text', { class: 'eixo-texto eixo-dia', x: centro, y: altura - margem.base + 16, 'text-anchor': 'middle' },
          i === 0 ? 'hoje' : diaDaSemana(ponto.dia)),
        i === 0 ? null : svg('text', { class: 'eixo-texto eixo-data', x: centro, y: altura - margem.base + 30, 'text-anchor': 'middle' },
          String(lerDia(ponto.dia).getDate())));
      if (ponto.quantidade > 0 && (i === 0 || i === indiceMaximo)) {
        grupo.append(svg('text', { class: 'barra-valor', x: centro, y: y - 6, 'text-anchor': 'middle' }, formatarNumero(ponto.quantidade)));
      }
      grupo.addEventListener('pointerenter', () => dica.mostrar(plural(ponto.quantidade, 'cartão', 'cartões'), rotuloDia, grupo.querySelector('.barra-alvo')));
      grupo.addEventListener('pointerleave', () => dica.esconder());
      desenho.append(grupo);
    });
    area.querySelector('svg')?.remove();
    area.prepend(desenho);
  }

  const observador = new ResizeObserver(([entrada]) => {
    const largura = Math.floor(entrada.contentRect.width);
    if (largura > 0) desenhar(largura);
  });
  observador.observe(area);

  const tabela = tabelaDados('Previsão de revisões',
    ['Dia', 'Cartões'],
    previsao.map((ponto, i) => [i === 0 ? `hoje, ${diaCurto(ponto.dia)}` : `${diaDaSemana(ponto.dia)}, ${diaCurto(ponto.dia)}`, formatarNumero(ponto.quantidade)]));

  return { el: h('div', { class: 'grafico' }, area, tabela), desligar: () => observador.disconnect() };
}

const NIVEIS = 4;

export function heatmapRevisoes(revisoesPorDia) {
  const maximo = Math.max(0, ...revisoesPorDia.map((registro) => registro.quantidade));
  const nivel = (quantidade) => (quantidade === 0 ? 0 : Math.max(1, Math.ceil((quantidade / maximo) * NIVEIS)));
  const deslocamento = lerDia(revisoesPorDia[0].dia).getDay();

  const area = h('div', { class: 'heatmap-area' });
  const dica = criarTooltip(area);
  const grade = h('div', { class: 'heatmap', 'aria-hidden': 'true' });
  for (let i = 0; i < deslocamento; i += 1) grade.append(h('span', { class: 'heat-celula heat-fora' }));
  revisoesPorDia.forEach((registro, i) => {
    const ultimo = i === revisoesPorDia.length - 1;
    const celula = h('span', { class: `heat-celula heat-${nivel(registro.quantidade)}${ultimo ? ' heat-hoje' : ''}` });
    celula.addEventListener('pointerenter', () =>
      dica.mostrar(plural(registro.quantidade, 'revisão', 'revisões'), `${diaDaSemana(registro.dia)}, ${diaCurto(registro.dia)}${ultimo ? ', hoje' : ''}`, celula));
    celula.addEventListener('pointerleave', () => dica.esconder());
    grade.append(celula);
  });

  const rotulosDias = h('div', { class: 'heatmap-dias mono', 'aria-hidden': 'true' },
    ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((nomeDia, i) => h('span', {}, i % 2 === 1 ? nomeDia : '')));

  const total = revisoesPorDia.reduce((soma, registro) => soma + registro.quantidade, 0);
  const ativos = revisoesPorDia.filter((registro) => registro.quantidade > 0).length;
  const legenda = h('div', { class: 'heatmap-legenda mono', 'aria-hidden': 'true' },
    h('span', {}, `${diaCurto(revisoesPorDia[0].dia)} a hoje`),
    h('span', { class: 'heatmap-escala' },
      'menos', Array.from({ length: NIVEIS + 1 }, (_, numeroNivel) => h('span', { class: `heat-celula heat-${numeroNivel}` })), 'mais',
      h('span', { class: 'heat-celula heat-0 heat-hoje' }), 'hoje'));

  area.append(rotulosDias, grade);
  const resumo = total === 0
    ? 'Nenhuma revisão nos últimos 30 dias.'
    : `${plural(total, 'revisão', 'revisões')} em ${plural(ativos, 'dia', 'dias')} de estudo.`;

  return h('div', { class: 'grafico' },
    h('p', { class: 'grafico-leitura', role: 'note' }, resumo),
    area,
    legenda,
    tabelaDados('Revisões por dia nos últimos 30 dias', ['Dia', 'Revisões'],
      revisoesPorDia.filter((registro) => registro.quantidade > 0).map((registro) => [`${diaDaSemana(registro.dia)}, ${diaCurto(registro.dia)}`, formatarNumero(registro.quantidade)])));
}
