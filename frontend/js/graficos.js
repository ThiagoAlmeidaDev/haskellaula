/* Gráficos em SVG próprio, sem biblioteca: barras da previsão (redesenhadas na largura real
   pelo ResizeObserver) e o mapa de calor das revisões, ambos com tabela de dados acessível. */
import { h, s, plural, diaCurto, diaDaSemana, lerDia, formatarNumero } from './dom.js';

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
  const r = Math.min(4, largura / 2, altura);
  if (altura <= 0) return '';
  return `M${x},${y + altura}V${y + r}Q${x},${y} ${x + r},${y}H${x + largura - r}Q${x + largura},${y} ${x + largura},${y + r}V${y + altura}Z`;
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
      const ret = alvo.getBoundingClientRect();
      const meio = ret.left + ret.width / 2 - caixa.left;
      const largura = dica.offsetWidth;
      const x = Math.max(0, Math.min(caixa.width - largura, meio - largura / 2));
      dica.style.transform = `translate(${x}px, ${ret.top - caixa.top - dica.offsetHeight - 8}px)`;
    },
    esconder() { dica.hidden = true; },
  };
}

function tabelaDados(legenda, cabecalhos, linhas) {
  return h('details', { class: 'tabela-dados' },
    h('summary', {}, 'Ver dados'),
    h('table', {},
      h('caption', { class: 'sr-only' }, legenda),
      h('thead', {}, h('tr', {}, cabecalhos.map((c) => h('th', { scope: 'col' }, c)))),
      h('tbody', {}, linhas.map((l) => h('tr', {}, l.map((c, i) => (i === 0 ? h('th', { scope: 'row' }, c) : h('td', {}, c))))))));
}

export function graficoPrevisao(previsao) {
  const area = h('div', { class: 'grafico-area' });
  const dica = criarTooltip(area);
  const maximo = Math.max(0, ...previsao.map((p) => p.quantidade));
  const teto = tetoLimpo(maximo);
  const indiceMaximo = previsao.findIndex((p) => p.quantidade === maximo);

  function desenhar(largura) {
    const altura = 200;
    const m = { topo: 20, dir: 4, base: 36, esq: 28 };
    const larguraUtil = largura - m.esq - m.dir;
    const alturaUtil = altura - m.topo - m.base;
    const banda = larguraUtil / previsao.length;
    const larguraBarra = Math.min(24, banda * 0.56);
    const escala = (v) => (v / teto) * alturaUtil;
    const marcas = teto % 2 === 0 ? [0, teto / 2, teto] : [0, teto];

    const svg = s('svg', {
      class: 'grafico-svg', width: largura, height: altura, viewBox: `0 0 ${largura} ${altura}`,
      role: 'img', 'aria-label': `Cartões agendados nos próximos 7 dias: ${previsao.map((p, i) => `${i === 0 ? 'hoje' : diaCurto(p.dia)} ${p.quantidade}`).join(', ')}`,
    });

    for (const marca of marcas) {
      const y = m.topo + alturaUtil - escala(marca) + 0.5;
      svg.append(
        s('line', { class: marca === 0 ? 'eixo-base' : 'eixo-grade', x1: m.esq, x2: largura - m.dir, y1: y, y2: y }),
        s('text', { class: 'eixo-texto', x: m.esq - 8, y: y + 4, 'text-anchor': 'end' }, formatarNumero(marca)));
    }

    previsao.forEach((p, i) => {
      const centro = m.esq + banda * i + banda / 2;
      const alturaBarra = escala(p.quantidade);
      const y = m.topo + alturaUtil - alturaBarra;
      const rotuloDia = i === 0 ? 'hoje' : `${diaDaSemana(p.dia)} ${diaCurto(p.dia)}`;
      const grupo = s('g', { class: i === 0 ? 'barra-grupo barra-hoje' : 'barra-grupo' },
        s('rect', { class: 'barra-alvo', x: centro - banda / 2, y: m.topo, width: banda, height: alturaUtil + m.base }),
        s('path', { class: 'barra-marca', d: caminhoBarra(centro - larguraBarra / 2, y, larguraBarra, alturaBarra) }),
        s('text', { class: 'eixo-texto eixo-dia', x: centro, y: altura - m.base + 16, 'text-anchor': 'middle' },
          i === 0 ? 'hoje' : diaDaSemana(p.dia)),
        i === 0 ? null : s('text', { class: 'eixo-texto eixo-data', x: centro, y: altura - m.base + 30, 'text-anchor': 'middle' },
          String(lerDia(p.dia).getDate())));
      if (p.quantidade > 0 && (i === 0 || i === indiceMaximo)) {
        grupo.append(s('text', { class: 'barra-valor', x: centro, y: y - 6, 'text-anchor': 'middle' }, formatarNumero(p.quantidade)));
      }
      grupo.addEventListener('pointerenter', () => dica.mostrar(plural(p.quantidade, 'cartão', 'cartões'), rotuloDia, grupo.querySelector('.barra-alvo')));
      grupo.addEventListener('pointerleave', () => dica.esconder());
      svg.append(grupo);
    });
    area.querySelector('svg')?.remove();
    area.prepend(svg);
  }

  const observador = new ResizeObserver(([entrada]) => {
    const largura = Math.floor(entrada.contentRect.width);
    if (largura > 0) desenhar(largura);
  });
  observador.observe(area);

  const tabela = tabelaDados('Previsão de revisões',
    ['Dia', 'Cartões'],
    previsao.map((p, i) => [i === 0 ? `hoje, ${diaCurto(p.dia)}` : `${diaDaSemana(p.dia)}, ${diaCurto(p.dia)}`, formatarNumero(p.quantidade)]));

  return { el: h('div', { class: 'grafico' }, area, tabela), desligar: () => observador.disconnect() };
}

const NIVEIS = 4;

export function heatmapRevisoes(revisoesPorDia) {
  const maximo = Math.max(0, ...revisoesPorDia.map((r) => r.quantidade));
  const nivel = (v) => (v === 0 ? 0 : Math.max(1, Math.ceil((v / maximo) * NIVEIS)));
  const deslocamento = lerDia(revisoesPorDia[0].dia).getDay();

  const area = h('div', { class: 'heatmap-area' });
  const dica = criarTooltip(area);
  const grade = h('div', { class: 'heatmap', 'aria-hidden': 'true' });
  for (let i = 0; i < deslocamento; i += 1) grade.append(h('span', { class: 'heat-celula heat-fora' }));
  revisoesPorDia.forEach((r, i) => {
    const ultimo = i === revisoesPorDia.length - 1;
    const celula = h('span', { class: `heat-celula heat-${nivel(r.quantidade)}${ultimo ? ' heat-hoje' : ''}` });
    celula.addEventListener('pointerenter', () =>
      dica.mostrar(plural(r.quantidade, 'revisão', 'revisões'), `${diaDaSemana(r.dia)}, ${diaCurto(r.dia)}${ultimo ? ', hoje' : ''}`, celula));
    celula.addEventListener('pointerleave', () => dica.esconder());
    grade.append(celula);
  });

  const rotulosDias = h('div', { class: 'heatmap-dias mono', 'aria-hidden': 'true' },
    ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((d, i) => h('span', {}, i % 2 === 1 ? d : '')));

  const total = revisoesPorDia.reduce((soma, r) => soma + r.quantidade, 0);
  const ativos = revisoesPorDia.filter((r) => r.quantidade > 0).length;
  const legenda = h('div', { class: 'heatmap-legenda mono', 'aria-hidden': 'true' },
    h('span', {}, `${diaCurto(revisoesPorDia[0].dia)} a hoje`),
    h('span', { class: 'heatmap-escala' },
      'menos', Array.from({ length: NIVEIS + 1 }, (_, n) => h('span', { class: `heat-celula heat-${n}` })), 'mais',
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
      revisoesPorDia.filter((r) => r.quantidade > 0).map((r) => [`${diaDaSemana(r.dia)}, ${diaCurto(r.dia)}`, formatarNumero(r.quantidade)])));
}
