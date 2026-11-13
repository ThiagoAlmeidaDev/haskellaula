/* Monta a landing: as seções na ordem da narrativa, o motor de movimento, o tom da barra de
   navegação conforme a seção embaixo dela e a passagem em que o fecho cobre a seção anterior,
   como uma carta posta sobre o maço. Devolve a limpeza que o roteador chama ao sair. */
import { h } from '../dom.js';
import { criarMotor, perfilDeMovimento } from './movimento.js';
import { heroi } from './secoes/heroi.js';
import { esquecimento } from './secoes/esquecimento.js';
import { sessao } from './secoes/sessao.js';
import { calendario } from './secoes/calendario.js';
import { letreiro } from './secoes/letreiro.js';
import { jeito } from './secoes/jeito.js';
import { final } from './secoes/final.js';

const ALTURA_NAV = 68;

function navegacao(motor, secoes) {
  const corpo = document.body.dataset;
  corpo.lpTom = 'escuro';
  motor.aoDesmontar(() => {
    delete corpo.lpTom;
    delete corpo.lpNav;
  });
  const { ScrollTrigger } = motor;
  motor.no(() => {
    for (const { el } of secoes) {
      ScrollTrigger.create({
        trigger: el, start: `top ${ALTURA_NAV / 2}px`, end: `bottom ${ALTURA_NAV / 2}px`,
        onToggle: (self) => { if (self.isActive) corpo.lpTom = el.dataset.tom; },
      });
    }
    if (!motor.animado) return;
    ScrollTrigger.create({
      start: 'top -160', end: 'max',
      onUpdate: (self) => { corpo.lpNav = self.direction === 1 ? 'oculta' : 'visivel'; },
      onLeaveBack: () => { corpo.lpNav = 'visivel'; },
    });
  });
}

function passagemFinal(motor, anterior, fecho) {
  if (!motor.animado) return;
  const { gsap, ScrollTrigger } = motor;
  const veu = h('div', { class: 'lp-veu', 'aria-hidden': 'true' });
  anterior.append(veu);
  motor.no(() => {
    ScrollTrigger.create({ trigger: anterior, start: 'bottom bottom', end: '+=100%', pin: true, pinSpacing: false });
    gsap.timeline({ scrollTrigger: { trigger: fecho, start: 'top bottom', end: 'top top', scrub: true } })
      .to(anterior.querySelector('.lp-wrap'), { scale: 0.9, yPercent: -3, ease: 'none' }, 0)
      .to(veu, { autoAlpha: 1, ease: 'none' }, 0);
  });
}

export async function montarLanding(main) {
  await document.fonts.ready;
  const perfil = perfilDeMovimento();
  const secoes = [heroi(), esquecimento(), sessao(), calendario(), letreiro(), jeito(), final()];

  main.classList.add('main-landing');
  document.body.dataset.landing = perfil;
  main.append(...secoes.map((s) => s.el));

  const motor = criarMotor(main, perfil);
  for (const secao of secoes) secao.animar(motor);
  passagemFinal(motor, secoes[5].el, secoes[6].el);
  navegacao(motor, secoes);
  motor.atualizar();

  return () => {
    motor.desmontar();
    main.classList.remove('main-landing');
    delete document.body.dataset.landing;
  };
}
