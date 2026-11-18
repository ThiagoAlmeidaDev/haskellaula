/* Sessão: a mesma carta de estudo do app, presa na tela enquanto a rolagem conta a sessão em três
   passos. A pergunta se escreve, a carta vira, "Bom" afunda e a carta voa para o trilho de dias.
   O passo ativo fica em data-passo, e o CSS decide como os outros aparecem em cada largura. */
import { h, kbd } from '../../dom.js';
import { PREFERENCIAS_PADRAO } from '../../sessao.js';
import { cartaEstudo } from '../../views/componentes.js';
import { SESSAO } from '../conteudo.js';
import { CURVAS, revelarTitulo } from '../movimento.js';

/* Escala em que a carta pousa no trilho, que é a largura de .trilho-fantasma dividida pela da carta. */
const ESCALA_NO_TRILHO = 0.1;

export function sessao() {
  const { carta: dados } = SESSAO;
  const carta = cartaEstudo({
    pergunta: dados.pergunta, resposta: dados.resposta, rotuloEsq: dados.baralho, rotuloDir: 'Novo',
    cor: dados.cor, padrao: dados.padrao, prefs: PREFERENCIAS_PADRAO,
  });
  const titulo = h('h2', { class: 'lp-h2', id: 'lp-sessao' }, SESSAO.titulo);
  const passos = SESSAO.passos.map((passo, i) => h('li', { class: 'sessao-passo', dataset: { passo: String(i) } },
    h('span', { class: 'sessao-num', 'aria-hidden': 'true' }, String(i + 1)),
    h('div', {}, h('h3', { class: 'sessao-passo-titulo' }, passo.titulo), h('p', { class: 'sessao-passo-texto' }, passo.texto))));
  const barra = h('span', { class: 'sessao-barra-cheia' });
  const respostas = SESSAO.respostas.map((resposta) => h('span', { class: `resposta ${resposta.classe}` }, h('span', { class: 'resposta-rotulo' }, resposta.rotulo), kbd(resposta.tecla)));
  const dias = SESSAO.trilho.map((diaDoTrilho) => h('span', { class: 'trilho-dia', dataset: { dia: String(diaDoTrilho.dia) } }, h('span', { class: 'trilho-ponto' }), h('span', { class: 'trilho-rotulo' }, diaDoTrilho.rotulo)));
  const fantasmas = dias.slice(2).map((dia) => {
    const fantasma = h('span', { class: 'trilho-fantasma', dataset: { cor: dados.cor } });
    dia.append(fantasma);
    return fantasma;
  });
  const trilho = h('div', { class: 'sessao-trilho' }, h('span', { class: 'trilho-linha' }), dias);

  const demo = h('div', { class: 'sessao-demo', 'aria-hidden': 'true' }, carta.el, h('div', { class: 'sessao-respostas' }, respostas), trilho);
  const palco = h('div', { class: 'sessao-palco' },
    h('div', { class: 'lp-wrap sessao-grade' },
      h('div', { class: 'sessao-texto' }, titulo, h('div', { class: 'sessao-lista' }, h('span', { class: 'sessao-barra' }, barra), h('ol', { class: 'sessao-passos' }, passos))),
      demo));
  const el = h('section', { class: 'lp-sec lp-sessao', dataset: { tom: 'claro', passo: 'todos' }, 'aria-labelledby': 'lp-sessao' }, palco);

  function animar(motor) {
    revelarTitulo(motor, titulo);
    if (!motor.animado || !matchMedia('(min-height: 600px)').matches) return;
    const { gsap, SplitText } = motor;

    motor.no(() => {
      el.dataset.passo = '0';
      const letras = SplitText.create(carta.el.querySelector('.carta-frente .carta-pergunta'), { type: 'words, chars' }).chars;
      const ponto = dias[1].querySelector('.trilho-ponto');
      const centro = (alvo) => {
        let x = alvo.offsetWidth / 2;
        let y = alvo.offsetHeight / 2;
        for (let no = alvo; no && no !== demo; no = no.offsetParent) {
          x += no.offsetLeft;
          y += no.offsetTop;
        }
        return { x, y };
      };
      const destino = () => {
        const de = centro(carta.el);
        const para = centro(ponto);
        return { x: para.x - de.x, y: para.y - ponto.offsetHeight / 2 - 6 - (carta.el.offsetHeight * ESCALA_NO_TRILHO) / 2 - de.y };
      };

      /* Onde cada passo começa no progresso da rolagem. Escrever é rápido, virar e voltar levam mais tempo. */
      const INICIO_DOS_PASSOS = [0, 0.22, 0.6];
      const linhaDoTempo = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: el, start: 'top top', end: '+=200%', pin: palco, scrub: 0.5, invalidateOnRefresh: true,
          onUpdate: (self) => { el.dataset.passo = String(INICIO_DOS_PASSOS.findLastIndex((inicio) => self.progress >= inicio)); },
        },
      });

      gsap.from(carta.el, {
        yPercent: 12, rotate: 4, autoAlpha: 0, duration: 1, ease: CURVAS.saida,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      });
      linhaDoTempo.fromTo(barra, { scaleY: 0 }, { scaleY: 1, duration: 1, transformOrigin: '50% 0%' }, 0)
        .from(letras, { autoAlpha: 0, duration: 0.01, stagger: 0.007 }, 0.03)
        .to(carta.carta, { rotationY: 180, duration: 0.1, ease: 'power2.inOut' }, 0.25)
        .from(respostas, { y: 24, autoAlpha: 0, duration: 0.05, stagger: 0.015, ease: CURVAS.saida }, 0.36)
        .to(respostas[2], { x: 3, y: 3, boxShadow: '1px 1px 0 #000', duration: 0.03 }, 0.48)
        .to(respostas, { y: 16, autoAlpha: 0, duration: 0.04, stagger: 0.008 }, 0.62)
        .from(trilho, { autoAlpha: 0, y: 30, duration: 0.05, ease: CURVAS.saida }, 0.63)
        .to(carta.el, { x: () => destino().x, y: () => destino().y, scale: ESCALA_NO_TRILHO, rotate: -8, duration: 0.14, ease: 'power3.inOut' }, 0.68)
        .from(fantasmas, { scale: 0, rotate: -40, autoAlpha: 0, duration: 0.05, stagger: 0.04, ease: CURVAS.mola }, 0.84);
    });
  }

  return { el, animar };
}
