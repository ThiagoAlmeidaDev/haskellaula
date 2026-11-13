/* Calendário de 70 dias. Abre com cartas de exemplo de vários baralhos nos dias em que voltam;
   apontar, focar ou tocar num desses dias mostra as perguntas dele num balão. Os outros dois
   botões soltam uma carta só nos dias do cenário escolhido. Com movimento, as cartas caem do alto. */
import { h } from '../../dom.js';
import { CALENDARIO, CENARIOS, EXEMPLOS_CALENDARIO, REVISOES_BOM } from '../conteudo.js';
import { CURVAS, magnetico, revelarTexto, revelarTitulo } from '../movimento.js';

const TOTAL = 70;

function diasDoExemplo(exemplo) {
  return REVISOES_BOM.map((d) => d - exemplo.inicio).filter((d) => d >= 1 && d < TOTAL);
}

export function calendario() {
  const grade = h('div', { class: 'calendario', role: 'group', 'aria-label': 'Calendário de 70 dias' },
    Array.from({ length: TOTAL }, (_, d) => h('span', { class: d === 0 ? 'cal-dia hoje' : 'cal-dia' }, h('span', { class: 'cal-numero' }, d === 0 ? 'hoje' : String(d)))));
  const conta = h('p', { class: 'calendario-conta', 'aria-live': 'polite' });
  const titulo = h('h2', { class: 'lp-h2', id: 'lp-calendario' }, CALENDARIO.titulo);
  const texto = h('p', { class: 'lp-paragrafo' }, CALENDARIO.texto);
  const balao = h('div', { class: 'cal-balao', hidden: true });
  const botoes = [
    h('button', { class: 'btn btn-sec', type: 'button', 'aria-pressed': 'false', dataset: { modo: 'exemplos' } }, 'Exemplos'),
    h('button', { class: 'btn btn-pri', type: 'button', 'aria-pressed': 'false', dataset: { modo: 'bom' } }, 'Acertando sempre'),
    h('button', { class: 'btn btn-perigo', type: 'button', 'aria-pressed': 'false', dataset: { modo: 'erro' } }, 'Errando no dia 7'),
  ];
  const imas = botoes.map((b) => h('span', { class: 'ima' }, b));
  const legenda = h('p', { class: 'legenda' },
    h('span', { class: 'legenda-item' }, h('span', { class: 'ponto', style: 'background: var(--cobalto)' }), 'hoje'),
    h('span', { class: 'legenda-item' }, h('span', { class: 'ponto', style: 'background: var(--sol)' }), 'dia de revisão'),
    h('span', { class: 'legenda-item' }, h('span', { class: 'ponto', style: 'background: var(--tomate)' }), 'dia em que errou'));
  const moldura = h('div', { class: 'calendario-moldura ficha' }, grade, balao);

  const el = h('section', { class: 'lp-sec lp-calendario', dataset: { tom: 'claro' }, 'aria-labelledby': 'lp-calendario' },
    h('div', { class: 'lp-wrap calendario-bloco' },
      h('div', { class: 'calendario-texto' }, titulo, texto, h('div', { class: 'calendario-acoes' }, imas), conta, legenda),
      moldura));

  /* Cada dia com exemplo ganha um botão do tamanho da célula; o balão mostra as cartas dele. */
  function mostrarBalao(dia, exemplos) {
    balao.replaceChildren(
      h('p', { class: 'cal-balao-titulo' }, `Dia ${dia}`),
      h('ul', {}, exemplos.map((e) => h('li', {}, h('span', { class: 'cal-balao-capa capa', dataset: { cor: e.cor } }), h('strong', {}, e.baralho), ` ${e.pergunta}`))));
    balao.hidden = false;
    const celula = grade.children[dia];
    const meio = celula.offsetLeft + celula.offsetWidth / 2;
    balao.style.left = `${Math.min(Math.max(meio, balao.offsetWidth / 2 + 8), moldura.clientWidth - balao.offsetWidth / 2 - 8)}px`;
    balao.style.top = `${celula.offsetTop - 8}px`;
  }
  const esconderBalao = () => { balao.hidden = true; };

  function animar(motor) {
    const { gsap } = motor;
    let soltas = null;

    function limpar() {
      soltas?.kill();
      esconderBalao();
      for (const dia of grade.children) {
        dia.classList.remove('marcado');
        dia.querySelectorAll('.cal-carta, .cal-exemplo').forEach((n) => n.remove());
      }
    }

    function soltar(cartas) {
      if (!motor.animado) return;
      soltas = gsap.timeline();
      cartas.forEach(({ carta, dia, marcar }, i) => {
        soltas.from(carta, { y: -90, rotate: -24, autoAlpha: 0, duration: 0.7, ease: CURVAS.queda }, i * 0.12)
          .add(() => marcar?.(), i * 0.12 + 0.42)
          .fromTo(dia, { scale: 0.86 }, { scale: 1, duration: 0.5, ease: CURVAS.mola }, i * 0.12 + 0.42);
      });
    }

    function exemplos() {
      const porDia = new Map();
      for (const e of EXEMPLOS_CALENDARIO) {
        for (const d of diasDoExemplo(e)) porDia.set(d, [...(porDia.get(d) ?? []), e]);
      }
      const cartas = [];
      for (const [d, lista] of [...porDia].sort((a, b) => a[0] - b[0])) {
        const dia = grade.children[d];
        lista.forEach((e, i) => {
          const carta = h('span', { class: 'cal-carta capa', dataset: { cor: e.cor }, style: `--pilha: ${i}` });
          dia.append(carta);
          cartas.push({ carta, dia });
        });
        const abrir = () => mostrarBalao(d, lista);
        dia.append(h('button', {
          class: 'cal-exemplo', type: 'button',
          'aria-label': `Dia ${d}: ${lista.map((e) => `${e.baralho}, ${e.pergunta}`).join('; ')}`,
          onpointerenter: abrir, onfocus: abrir, onclick: abrir, onpointerleave: esconderBalao, onblur: esconderBalao,
        }));
      }
      conta.textContent = CALENDARIO.exemplos;
      soltar(cartas);
    }

    function cenario(chave) {
      const c = CENARIOS[chave];
      conta.textContent = c.texto;
      soltar(c.dias.map((d) => {
        const dia = grade.children[d];
        const carta = h('span', { class: d === c.erro ? 'cal-carta errada' : 'cal-carta' });
        dia.append(carta);
        const marcar = () => dia.classList.add('marcado');
        if (!motor.animado) marcar();
        return { carta, dia, marcar };
      }));
    }

    function mostrar(modo) {
      for (const b of botoes) b.setAttribute('aria-pressed', String(b.dataset.modo === modo));
      limpar();
      if (modo === 'exemplos') exemplos();
      else cenario(modo);
    }

    for (const b of botoes) b.addEventListener('click', () => mostrar(b.dataset.modo));
    imas.forEach((i) => magnetico(motor, i, { forca: 0.22 }));
    motor.aoDesmontar(() => soltas?.kill());

    revelarTitulo(motor, titulo);
    revelarTexto(motor, [texto, ...imas, conta, legenda], { gatilho: titulo });
    if (!motor.animado) {
      mostrar('exemplos');
      return;
    }
    for (const b of botoes) b.setAttribute('aria-pressed', String(b.dataset.modo === 'exemplos'));
    conta.textContent = CALENDARIO.exemplos;
    /* As cartas caem depois da cascata da grade: as duas animam a escala das células. */
    let primeiraQueda = null;
    motor.aoDesmontar(() => primeiraQueda?.kill());
    motor.no(() => {
      gsap.from(grade.children, {
        scale: 0.4, autoAlpha: 0, duration: 0.7, ease: CURVAS.saida,
        stagger: { each: 0.012, grid: 'auto', from: 0 },
        scrollTrigger: { trigger: grade, start: 'top 85%', once: true },
        onComplete: () => { primeiraQueda = gsap.delayedCall(0.1, () => mostrar('exemplos')); },
      });
    });
  }

  return { el, animar };
}
