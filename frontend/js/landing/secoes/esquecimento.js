/* Esquecimento: a frase acende palavra por palavra, depois o gráfico desenha as duas curvas dia a
   dia (sem revisão e com as revisões do SM-2) e uma cortina clara abre a partir da última
   revisão, levando para a parte clara da página. O gráfico é ilustrativo, só os dias vêm do SM-2. */
import { h, svg } from '../../dom.js';
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

/* Lembrança logo antes de cada revisão. As revisões chegam quando ela cai para uns 70%. */
const QUEDA_ATE_REVISAR = -Math.log((0.7 - PISO) / (1 - PISO));

function trecho(inicio, fim, estabilidade) {
  const pontos = [];
  for (let dia = inicio; dia <= fim + 1e-9; dia += 0.25) {
    const lembranca = PISO + (1 - PISO) * Math.exp(-(dia - inicio) / estabilidade);
    pontos.push(`${x(dia).toFixed(1)} ${y(lembranca).toFixed(1)}`);
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
  const marcas = REVISOES_BOM.map((dia) => svg('g', { class: 'curva-marca', transform: `translate(${x(dia)} ${y(1)})` },
    svg('rect', { x: '-11', y: '-34', width: '22', height: '30', rx: '4', transform: 'rotate(-8)' })));
  const desenho = svg('svg', {
    class: 'curva', viewBox: `0 0 ${LARGURA} ${ALTURA}`, role: 'img',
    'aria-label': 'Gráfico ilustrativo: sem revisão a lembrança cai em poucos dias; com o Recall ela volta ao topo nos dias 1, 7, 22 e 60, e cai cada vez mais devagar.',
  },
  svg('path', { class: 'curva-eixo', d: `M${x(0)} ${BASE} H${x(ULTIMO_DIA)}` }),
  svg('path', { class: 'curva-sem', d: semRevisao }),
  comRecall.map((caminho) => svg('path', { class: 'curva-com', d: caminho })),
  marcas);
  return { svg: desenho, marcas, trechos: [...desenho.querySelectorAll('.curva-com')], semRevisao: desenho.querySelector('.curva-sem'), eixo: desenho.querySelector('.curva-eixo') };
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
  const partesDoGrafico = grafico();
  /* Os dias ficam fora do SVG para manter o tamanho de texto legível quando o gráfico encolhe no celular. */
  const dias = h('div', { class: 'curva-dias', 'aria-hidden': 'true' },
    [0, ...REVISOES_BOM.slice(1)].map((numeroDoDia) => h('span', { style: `left: ${(x(numeroDoDia) / LARGURA) * 100}%` }, numeroDoDia ? `dia ${numeroDoDia}` : 'hoje')));
  const cortina = h('div', { class: 'esquecer-cortina', 'aria-hidden': 'true' });
  const palco = h('div', { class: 'esquecer-palco' },
    frase,
    h('div', { class: 'lp-wrap esquecer-grade' },
      h('div', { class: 'esquecer-texto' }, titulo, texto),
      h('figure', { class: 'esquecer-figura' }, h('div', { class: 'esquecer-placar' }, dia, fecho), partesDoGrafico.svg, dias, legenda)),
    cortina);
  const el = h('section', { class: 'lp-sec lp-esquecer', dataset: { tom: 'escuro' }, 'aria-labelledby': 'lp-esquecer' }, palco);

  function animar(motor) {
    if (!motor.animado) return;
    const { gsap, SplitText } = motor;

    if (motor.perfil === 'leve' && !matchMedia('(min-height: 640px)').matches) {
      revelarTitulo(motor, titulo);
      revelarTexto(motor, [texto, partesDoGrafico.svg, dias, legenda], { gatilho: titulo });
      return;
    }

    el.dataset.modo = 'cena';
    motor.no(() => {
      const palavras = SplitText.create(frase, { type: 'words' }).words;
      /* A ponta redonda desenha um ponto mesmo com o traço todo escondido, então o caminho só aparece quando começa a ser desenhado. */
      const desenhar = (caminho, inicio, duracao) => {
        const total = caminho.getTotalLength();
        gsap.set(caminho, { strokeDasharray: total, strokeDashoffset: total, autoAlpha: 0 });
        linhaDoTempo.set(caminho, { autoAlpha: 1 }, inicio).to(caminho, { strokeDashoffset: 0, duration: duracao }, inicio);
      };
      const contagem = { dia: 0 };
      const escreverDia = () => { dia.textContent = `dia ${Math.round(contagem.dia)}`; };
      escreverDia();

      const ultimaMarca = partesDoGrafico.marcas[partesDoGrafico.marcas.length - 1];
      const escalaCortina = () => {
        const caixa = palco.getBoundingClientRect();
        const marca = ultimaMarca.getBoundingClientRect();
        const centroX = marca.left + marca.width / 2 - caixa.left;
        const centroY = marca.top + marca.height / 2 - caixa.top;
        gsap.set(cortina, { left: centroX, top: centroY });
        const raio = Math.hypot(Math.max(centroX, caixa.width - centroX), Math.max(centroY, caixa.height - centroY));
        return (raio * 2) / cortina.offsetWidth + 0.2;
      };

      const linhaDoTempo = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: el, start: 'top top', end: '+=240%', pin: palco, scrub: 0.6, invalidateOnRefresh: true },
      });
      gsap.from(palavras, {
        opacity: 0.12, stagger: 0.1, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 45%', end: 'top top', scrub: 0.6 },
      });
      linhaDoTempo.to(frase, { yPercent: -40, autoAlpha: 0, duration: 0.06, ease: 'power2.in' }, 0.03)
        .from([titulo, texto], { y: 50, autoAlpha: 0, duration: 0.08, stagger: 0.02, ease: CURVAS.saida }, 0.1)
        .from([dia.parentElement, dias, legenda], { autoAlpha: 0, duration: 0.05 }, 0.13)
        .fromTo(partesDoGrafico.eixo, { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: 0.05 }, 0.13)
        .from(fecho, { autoAlpha: 0, y: 12, duration: 0.04 }, 0.8);

      desenhar(partesDoGrafico.semRevisao, 0.17, 0.12);
      const inicioRecall = 0.3;
      const fatia = 0.48 / partesDoGrafico.trechos.length;
      partesDoGrafico.trechos.forEach((caminho, i) => {
        desenhar(caminho, inicioRecall + i * fatia, fatia);
        const marca = partesDoGrafico.marcas[i];
        if (marca) linhaDoTempo.from(marca, { scale: 0, rotate: -30, transformOrigin: '50% 100%', duration: 0.03, ease: CURVAS.mola }, inicioRecall + (i + 1) * fatia - 0.01);
      });
      linhaDoTempo.to(contagem, { dia: REVISOES_BOM[REVISOES_BOM.length - 1], duration: 0.48, onUpdate: escreverDia }, inicioRecall)
        .fromTo(cortina, { scale: 0 }, { scale: escalaCortina, duration: 0.12, ease: 'power2.in' }, 0.86);
    });
  }

  return { el, animar };
}
