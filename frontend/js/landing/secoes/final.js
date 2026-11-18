/* Fecho: as oito capas de baralho abrem em roda ao redor da chamada final. A roda gira devagar
   sozinha e a rolagem soma um giro por cima. */
import { h } from '../../dom.js';
import { CORES, PADROES } from '../../views/componentes.js';
import { FINAL } from '../conteudo.js';
import { CURVAS, magnetico, revelarTexto, revelarTitulo } from '../movimento.js';

export function final() {
  const raios = CORES.map((cor, i) => h('span', { class: 'final-raio', style: `--i: ${i}` },
    h('span', { class: 'final-carta capa', dataset: { cor: cor.valor, padrao: PADROES[i % PADROES.length].valor } })));
  const giro = h('div', { class: 'final-giro' }, raios);
  const roda = h('div', { class: 'final-roda', 'aria-hidden': 'true' }, giro);
  const titulo = h('h2', { class: 'lp-h2 final-titulo', id: 'lp-final' }, FINAL.titulo);
  const texto = h('p', { class: 'lp-paragrafo' }, FINAL.texto);
  const acao = h('span', { class: 'ima' }, h('a', { class: 'btn btn-sol btn-alto', href: '#/criar-conta' }, 'Criar conta grátis'));
  const el = h('section', { class: 'lp-sec lp-final', dataset: { tom: 'escuro' }, 'aria-labelledby': 'lp-final' },
    roda,
    h('div', { class: 'lp-wrap final-conteudo' }, titulo, texto, acao));

  function animar(motor) {
    revelarTitulo(motor, titulo);
    revelarTexto(motor, [texto, acao], { gatilho: titulo, atraso: 0.35 });
    magnetico(motor, acao, { forca: 0.4 });
    if (!motor.animado) return;
    const { gsap } = motor;
    const cartas = raios.map((raio) => raio.firstElementChild);

    motor.no(() => {
      gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 65%', once: true } })
        .from(raios, { rotation: 0, duration: 1.6, ease: CURVAS.cinema, stagger: 0.03 }, 0)
        .from(cartas, { y: 0, scale: 0.6, duration: 1.4, ease: CURVAS.saida, stagger: 0.03 }, 0.15);

      gsap.fromTo(giro, { rotation: -50 }, {
        rotation: 50, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1 },
      });

      gsap.to(roda, { rotation: 360, duration: 120, ease: 'none', repeat: -1 });
    });
  }

  return { el, animar };
}
