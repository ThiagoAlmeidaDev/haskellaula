/* Letreiro: perguntas reais correndo em duas linhas opostas. A velocidade e a inclinação seguem a
   rolagem, e o sentido vira quando a pessoa sobe a página. Passar o ponteiro segura as linhas. */
import { h } from '../../dom.js';
import { LETREIRO } from '../conteudo.js';

export function letreiro() {
  const item = ([pergunta, resposta]) => h('span', { class: 'letreiro-item' }, pergunta, h('strong', {}, resposta));
  const linha = (lista) => h('div', { class: 'letreiro-linha', 'aria-hidden': 'true' },
    h('div', { class: 'letreiro-trilho' }, [...lista, ...lista].map(item)));
  const linhas = [linha(LETREIRO.slice(0, 6)), linha(LETREIRO.slice(6))];
  const el = h('section', { class: 'lp-sec lp-letreiro', dataset: { tom: 'sol' }, 'aria-label': 'Exemplos de cartões' },
    linhas,
    h('p', { class: 'sr-only' }, LETREIRO.map(([pergunta, resposta]) => `${pergunta} ${resposta}`).join('; ')));

  function animar(motor) {
    if (!motor.animado) return;
    const { gsap, ScrollTrigger } = motor;

    motor.no(() => {
      const trilhos = linhas.map((elementoDaLinha) => elementoDaLinha.firstElementChild);
      const voltas = trilhos.map((trilho, i) => gsap.fromTo(trilho, { xPercent: i ? -50 : 0 }, { xPercent: i ? 0 : -50, duration: i ? 52 : 44, ease: 'none', repeat: -1 }));
      /* Começa longe do zero para poder andar para trás quando a página sobe. */
      for (const volta of voltas) volta.totalTime(volta.duration() * 200);
      const inclinar = gsap.quickTo(trilhos, 'skewX', { duration: 0.5, ease: 'power3.out' });
      let segurando = false;
      let sentido = 1;
      let calma = null;
      motor.aoDesmontar(() => calma?.kill());

      const ritmo = (extra = 0) => {
        const escala = segurando ? 0 : sentido * (1 + extra);
        for (const volta of voltas) gsap.to(volta, { timeScale: escala, duration: 0.6, ease: 'power2.out', overwrite: true });
      };

      ScrollTrigger.create({
        trigger: el, start: 'top bottom', end: 'bottom top',
        onUpdate: (self) => {
          const velocidade = self.getVelocity();
          sentido = self.direction;
          inclinar(gsap.utils.clamp(-9, 9, velocidade / -260));
          ritmo(Math.min(Math.abs(velocidade) / 400, 5));
          calma?.kill();
          calma = gsap.delayedCall(0.12, () => {
            inclinar(0);
            ritmo();
          });
        },
        onToggle: (self) => { for (const volta of voltas) volta.paused(!self.isActive); },
      });

      el.addEventListener('pointerenter', () => { segurando = true; ritmo(); });
      el.addEventListener('pointerleave', () => { segurando = false; ritmo(); });
    });
  }

  return { el, animar };
}
