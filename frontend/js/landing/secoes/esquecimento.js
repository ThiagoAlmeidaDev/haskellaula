/* Esquecimento: a frase acende palavra por palavra, depois o gráfico desenha as duas curvas dia a
   dia (sem revisão e com as revisões do SM-2) e uma cortina clara abre a partir da última
   revisão, levando para a parte clara da página. O gráfico é ilustrativo: só os dias são do SM-2. */
import { h, s } from '../../dom.js';
import { ESQUECIMENTO, REVISOES_BOM } from '../conteudo.js';
import { CURVAS, revelarTexto, revelarTitulo } from '../movimento.js';

const LARGURA = 1000;
const ALTURA = 430;
const BASE = 360;
const TOPO = 56;
const ULTIMO_DIA = 64;
const x = (dia) => 24 + (dia / ULTIMO_DIA) * 952;
const y = (lembranca) => BASE - lembranca * (BASE - TOPO);
const PISO = 0.08;

/* Lembrança logo antes de cada revisão: as revisões chegam quando ela cai a uns 70%. */
const QUEDA_ATE_REVISAR = -Math.log((0.7 - PISO) / (1 - PISO));

function trecho(inicio, fim, estabilidade) {
  const pontos = [];
  for (let d = inicio; d <= fim + 1e-9; d += 0.25) {
    const r = PISO + (1 - PISO) * Math.exp(-(d - inicio) / estabilidade);
    pontos.push(`${x(d).toFixed(1)} ${y(r).toFixed(1)}`);
  }
  return pontos;
}

function caminhos() {
  const semRevisao = `M${trecho(0, ULTIMO_DIA, 1.6).join(' L')}`;
  const dias = [0, ...REVISOES_BOM];
  const comRecall = dias.map((inicio, i) => {
    const fim = dias[i + 1] ?? ULTIMO_DIA;
    const estabilidade = dias[i + 1] ? (fim - inicio) / QUEDA_ATE_REVISAR : 240;
    const subida = dias[i + 1] ? ` L${x(fim).toFixed(1)} ${y(1).toFixed(1)}` : '';
    return `M${trecho(inicio, fim, estabilidade).join(' L')}${subida}`;
  });
  return { semRevisao, comRecall };
}

function grafico() {
  const { semRevisao, comRecall } = caminhos();
  const marcas = REVISOES_BOM.map((dia) => s('g', { class: 'curva-marca', transform: `translate(${x(dia)} ${y(1)})` },
    s('rect', { x: '-11', y: '-34', width: '22', height: '30', rx: '4', transform: 'rotate(-8)' })));
  const svg = s('svg', {
    class: 'curva', viewBox: `0 0 ${LARGURA} ${ALTURA}`, role: 'img',
    'aria-label': 'Gráfico ilustrativo: sem revisão a lembrança cai em poucos dias; com o Recall ela volta ao topo nos dias 1, 7, 22 e 60, e cai cada vez mais devagar.',
  },
  s('path', { class: 'curva-eixo', d: `M${x(0)} ${BASE} H${x(ULTIMO_DIA)}` }),
  s('path', { class: 'curva-sem', d: semRevisao }),
  comRecall.map((d) => s('path', { class: 'curva-com', d })),
  marcas);
  return { svg, marcas, trechos: [...svg.querySelectorAll('.curva-com')], semRevisao: svg.querySelector('.curva-sem'), eixo: svg.querySelector('.curva-eixo') };
}

export function esquecimento() {
  const frase = h('p', { class: 'esquecer-frase' }, ESQUECIMENTO.frase);
  const titulo = h('h2', { class: 'lp-h2', id: 'lp-esquecer' }, ESQUECIMENTO.titulo);
  const texto = h('p', { class: 'lp-paragrafo' }, ESQUECIMENTO.texto);
  const legenda = h('p', { class: 'curva-legenda' },
    h('span', { class: 'curva-chave curva-chave-sem' }, ESQUECIMENTO.semRevisao),
    h('span', { class: 'curva-chave curva-chave-com' }, ESQUECIMENTO.comRecall));
  const dia = h('span', { class: 'esquecer-dia', 'aria-hidden': 'true' }, 'dia 60');
  const fecho = h('span', { class: 'esquecer-fecho' }, ESQUECIMENTO.fecho);
  const g = grafico();
  /* Os dias ficam fora do SVG para manter o tamanho de texto legível quando o gráfico encolhe no celular. */
  const dias = h('div', { class: 'curva-dias', 'aria-hidden': 'true' },
    [0, ...REVISOES_BOM.slice(1)].map((d) => h('span', { style: `left: ${(x(d) / LARGURA) * 100}%` }, d ? `dia ${d}` : 'hoje')));
  const cortina = h('div', { class: 'esquecer-cortina', 'aria-hidden': 'true' });
  const palco = h('div', { class: 'esquecer-palco' },
    frase,
    h('div', { class: 'lp-wrap esquecer-grade' },
      h('div', { class: 'esquecer-texto' }, titulo, texto),
      h('figure', { class: 'esquecer-figura' }, h('div', { class: 'esquecer-placar' }, dia, fecho), g.svg, dias, legenda)),
    cortina);
  const el = h('section', { class: 'lp-sec lp-esquecer', dataset: { tom: 'escuro' }, 'aria-labelledby': 'lp-esquecer' }, palco);

  function animar(motor) {
    if (!motor.animado) return;
    const { gsap, SplitText } = motor;

    if (motor.perfil === 'leve' && !matchMedia('(min-height: 640px)').matches) {
      revelarTitulo(motor, titulo);
      revelarTexto(motor, [texto, g.svg, dias, legenda], { gatilho: titulo });
      return;
    }

    el.dataset.modo = 'cena';
    motor.no(() => {
      const palavras = SplitText.create(frase, { type: 'words' }).words;
      /* A ponta redonda desenha um ponto mesmo com o traço todo escondido: o caminho só aparece quando começa a ser desenhado. */
      const desenhar = (caminho, inicio, duracao) => {
        const total = caminho.getTotalLength();
        gsap.set(caminho, { strokeDasharray: total, strokeDashoffset: total, autoAlpha: 0 });
        tl.set(caminho, { autoAlpha: 1 }, inicio).to(caminho, { strokeDashoffset: 0, duration: duracao }, inicio);
      };
      const contagem = { dia: 0 };
      const escreverDia = () => { dia.textContent = `dia ${Math.round(contagem.dia)}`; };
      escreverDia();

      const ultimaMarca = g.marcas[g.marcas.length - 1];
      const escalaCortina = () => {
        const caixa = palco.getBoundingClientRect();
        const marca = ultimaMarca.getBoundingClientRect();
        const cx = marca.left + marca.width / 2 - caixa.left;
        const cy = marca.top + marca.height / 2 - caixa.top;
        gsap.set(cortina, { left: cx, top: cy });
        const raio = Math.hypot(Math.max(cx, caixa.width - cx), Math.max(cy, caixa.height - cy));
        return (raio * 2) / cortina.offsetWidth + 0.2;
      };

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: el, start: 'top top', end: '+=240%', pin: palco, scrub: 0.6, invalidateOnRefresh: true },
      });
      gsap.from(palavras, {
        opacity: 0.12, stagger: 0.1, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 45%', end: 'top top', scrub: 0.6 },
      });
      tl.to(frase, { yPercent: -40, autoAlpha: 0, duration: 0.06, ease: 'power2.in' }, 0.03)
        .from([titulo, texto], { y: 50, autoAlpha: 0, duration: 0.08, stagger: 0.02, ease: CURVAS.saida }, 0.1)
        .from([dia.parentElement, dias, legenda], { autoAlpha: 0, duration: 0.05 }, 0.13)
        .fromTo(g.eixo, { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: 0.05 }, 0.13)
        .from(fecho, { autoAlpha: 0, y: 12, duration: 0.04 }, 0.8);

      desenhar(g.semRevisao, 0.17, 0.12);
      const inicioRecall = 0.3;
      const fatia = 0.48 / g.trechos.length;
      g.trechos.forEach((caminho, i) => {
        desenhar(caminho, inicioRecall + i * fatia, fatia);
        const marca = g.marcas[i];
        if (marca) tl.from(marca, { scale: 0, rotate: -30, transformOrigin: '50% 100%', duration: 0.03, ease: CURVAS.mola }, inicioRecall + (i + 1) * fatia - 0.01);
      });
      tl.to(contagem, { dia: REVISOES_BOM[REVISOES_BOM.length - 1], duration: 0.48, onUpdate: escreverDia }, inicioRecall)
        .fromTo(cortina, { scale: 0 }, { scale: escalaCortina, duration: 0.12, ease: 'power2.in' }, 0.86);
    });
  }

  return { el, animar };
}
