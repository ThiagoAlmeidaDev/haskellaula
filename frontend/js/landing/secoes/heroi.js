/* Herói: título em escala de cartaz sobre o palco escuro e o maço de cartas. No perfil "pleno" o
   maço é a cena 3D; nos outros, cartas em DOM com a mesma coreografia. Ao rolar, o herói fica
   preso, o título sobe em camadas e o maço fecha e mergulha em direção à câmera. */
import { h } from '../../dom.js';
import { HEROI, MACO } from '../conteudo.js';
import { CURVAS, magnetico } from '../movimento.js';

function faceDom(c, lado) {
  return h('div', { class: `carta-face ${lado === 'frente' ? 'carta-frente' : 'carta-verso'}` },
    h('header', { class: 'carta-faixa capa', dataset: { cor: c.cor, padrao: c.padrao } }, h('span', {}, c.baralho), h('span', {}, 'Recall')),
    h('div', { class: 'carta-miolo' },
      lado === 'frente' ? h('p', { class: 'carta-pergunta' }, c.pergunta) : h('p', { class: 'carta-resposta' }, c.resposta)));
}

/* Três camadas por carta: a de fora leva entrada e rolagem, a do meio flutua, a de dentro vira e
   sobe em destaque pelo CSS. Cada uma tem um dono só do transform. Com o ponteiro sobre o maço a
   flutuação para; ao sair de uma carta ela desvira e volta ao lugar. */
function macoDom(motor, palco) {
  const { gsap } = motor;
  const cartas = MACO.slice(0, 5).map((c) => {
    const el = h('div', { class: 'heroi-carta' },
      h('div', { class: 'heroi-flutua' }, h('div', { class: 'heroi-gira' }, faceDom(c, 'frente'), faceDom(c, 'verso'))));
    el.addEventListener('click', () => el.classList.toggle('virada'));
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') el.classList.remove('virada'); });
    return el;
  });
  const maco = h('div', { class: 'heroi-maco' }, cartas);
  palco.append(maco);

  const meio = (cartas.length - 1) / 2;
  const leque = {
    xPercent: (i) => (i - meio) * 26,
    yPercent: (i) => Math.abs(i - meio) * 5,
    rotation: (i) => (i - meio) * 8,
  };

  motor.no(() => {
    if (!motor.animado) {
      gsap.set(cartas, leque);
      return;
    }
    const flutuantes = cartas.map((c) => c.firstElementChild);
    const flutua = gsap.to(flutuantes, { y: -10, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true, stagger: { each: 0.25, from: 'center' } });
    let entrou = false;
    let sobre = false;
    const ritmo = () => flutua.paused(!entrou || sobre);
    maco.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { sobre = true; ritmo(); } });
    maco.addEventListener('pointerleave', () => { sobre = false; ritmo(); });

    gsap.timeline({ delay: 0.25 })
      .from(cartas, { y: () => window.innerHeight * 0.8, rotation: (i) => (i - meio) * 22, duration: 1.1, ease: CURVAS.saida, stagger: 0.08 })
      .to(cartas, { ...leque, duration: 1, ease: CURVAS.mola, stagger: 0.03 }, '-=0.3')
      .add(() => {
        entrou = true;
        ritmo();
      });
  });

  return {
    rolar(tl) {
      tl.fromTo(cartas, leque, { xPercent: 0, yPercent: 0, rotation: (i) => (i - meio) * 3, duration: 0.35, ease: 'power2.inOut', immediateRender: false }, 0)
        .fromTo(cartas, { y: 0, scale: 1, autoAlpha: 1 }, { y: () => -window.innerHeight * 0.5, scale: 1.25, autoAlpha: 0, duration: 0.6, ease: 'power2.in', stagger: 0.04, immediateRender: false }, 0.35);
    },
  };
}

/* O maço centra a 72% da largura útil da grade: à direita do título e sobre a coluna do texto. */
function ancoraDoMaco(grade, palco) {
  const estilo = getComputedStyle(grade);
  /* Abaixo de 960px a grade se desfaz (display: contents, sem caixa para medir) e o palco vira uma
     linha só do maço, entre o título e o pé: lá ele fica no centro. Acontece quando a janela do
     perfil "pleno" estreita depois de a cena montar. */
  if (estilo.display === 'contents') return 0.5;
  const caixa = grade.getBoundingClientRect();
  const esquerda = caixa.left + parseFloat(estilo.paddingLeft);
  const util = caixa.width - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
  const p = palco.getBoundingClientRect();
  return (esquerda + util * 0.72 - p.left) / p.width;
}

/* O maço aberto fica entre o pé da barra de navegação e o topo do pé do herói. Usa offsetTop, que
   ignora o transform da rolagem: o pé e o palco medem a partir do topo do herói. */
function faixaDoMaco(pe, palco) {
  const nav = parseFloat(getComputedStyle(document.body).getPropertyValue('--nav'));
  const altura = palco.offsetHeight;
  return { topo: Math.max(0, nav - palco.offsetTop) / altura, base: (pe.offsetTop - palco.offsetTop) / altura };
}

export function heroi() {
  const titulo = h('h1', { class: 'lp-titulo heroi-titulo', id: 'lp-titulo', tabindex: '-1' }, HEROI.titulo);
  const sub = h('p', { class: 'heroi-sub' }, HEROI.sub);
  const criar = h('span', { class: 'ima' }, h('a', { class: 'btn btn-sol btn-alto', href: '#/criar-conta' }, 'Criar conta grátis'));
  const entrar = h('span', { class: 'ima' }, h('a', { class: 'btn btn-vazado btn-alto', href: '#/entrar' }, 'Entrar'));
  const pe = h('div', { class: 'heroi-pe' }, sub, h('div', { class: 'lp-acoes' }, criar, entrar));
  const grade = h('div', { class: 'lp-wrap heroi-grade' }, titulo, pe);
  const cenaEl = h('div', { class: 'heroi-cena' });
  const palco = h('div', { class: 'heroi-palco', 'aria-hidden': 'true' }, cenaEl);

  const el = h('section', { class: 'lp-sec lp-heroi', dataset: { tom: 'escuro' }, 'aria-labelledby': 'lp-titulo' },
    palco,
    grade);

  function animar(motor) {
    const { gsap, SplitText } = motor;
    magnetico(motor, criar);
    magnetico(motor, entrar);

    const params = { entrada: 0, fechar: 0, voo: 0 };
    let maco = null;
    let cena = null;
    let desmontado = false;
    motor.aoDesmontar(() => {
      desmontado = true;
      cena?.destruir();
    });

    if (motor.perfil === 'pleno') {
      motor.no(() => gsap.set(cenaEl, { autoAlpha: 0 }));
      import('../cena-baralho.js')
        .then(({ criarCenaBaralho }) => criarCenaBaralho(cenaEl, MACO, params, {
          ancora: () => ancoraDoMaco(grade, cenaEl),
          faixa: () => faixaDoMaco(pe, palco),
        }))
        .then((pronta) => {
          if (desmontado) {
            pronta.destruir();
            return;
          }
          cena = pronta;
          motor.no(() => {
            gsap.to(cenaEl, { autoAlpha: 1, duration: 0.8 });
            gsap.to(params, { entrada: 2.1, duration: 2.9, ease: 'none' });
          });
        })
        .catch((erro) => {
          /* A cena falhou: o herói fica com o maço em DOM e o erro segue para o console. */
          if (!desmontado) {
            macoDom(motor, palco);
          }
          throw erro;
        });
    } else {
      maco = macoDom(motor, palco);
    }

    if (!motor.animado) return;

    motor.no(() => {
      const partes = SplitText.create(titulo, { type: 'lines, words, chars', mask: 'lines', linesClass: 'lp-linha' });
      gsap.timeline({ defaults: { ease: CURVAS.saida } })
        .from(partes.chars, { yPercent: 115, rotate: 6, duration: 1.3, stagger: 0.02 }, 0.15)
        .from(sub, { y: 24, autoAlpha: 0, duration: 1 }, 0.8)
        .from([criar, entrar], { y: 30, autoAlpha: 0, scale: 0.92, duration: 1, ease: CURVAS.mola, stagger: 0.08 }, 0.9);

      /* Prende quando o pé do herói chega ao fim da tela: com o herói da altura da tela é o mesmo
         que prender no topo; numa tela mais baixa que ele, a chamada e os botões aparecem antes de sumir. */
      const rolagem = gsap.timeline({
        scrollTrigger: { trigger: el, start: 'bottom bottom', end: '+=110%', pin: true, scrub: 0.8 },
        defaults: { ease: 'none' },
      });
      partes.lines.forEach((linha, i) => {
        rolagem.to(linha, { yPercent: -60 - i * 45, autoAlpha: 0, duration: 0.55, ease: 'power2.in' }, 0.04 * i);
      });
      rolagem
        .to(pe, { y: -60, autoAlpha: 0, duration: 0.3, ease: 'power2.in' }, 0)
        .to(params, { fechar: 1, duration: 0.35, ease: 'power1.inOut' }, 0)
        .to(params, { voo: 1, duration: 0.65 }, 0.32)
        .to(palco, { autoAlpha: 0, duration: 0.12 }, 0.88);
      maco?.rolar(rolagem);
    });
  }

  return { el, animar };
}
