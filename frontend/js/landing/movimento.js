/* Motor de movimento da landing. GSAP, ScrollTrigger, SplitText e CustomEase vêm de
   frontend/vendor e só carregam quando a landing abre. Toda animação nasce dentro do contexto
   de criarMotor, e desmontar() desfaz pins, splits, ouvintes e o scroll suave de uma vez. */
import { gsap } from '../../vendor/gsap/index.js';
import { ScrollTrigger } from '../../vendor/gsap/ScrollTrigger.js';
import { SplitText } from '../../vendor/gsap/SplitText.js';
import { CustomEase } from '../../vendor/gsap/CustomEase.js';
import Lenis from '../../vendor/lenis.js';

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

/* As curvas da landing. "saida" e "mola" repetem --saida e --mola do styles.css. */
export const CURVAS = {
  saida: CustomEase.create('lp-saida', '0.16, 1, 0.3, 1'),
  mola: CustomEase.create('lp-mola', '0.34, 1.56, 0.64, 1'),
  cinema: CustomEase.create('lp-cinema', '0.76, 0, 0.24, 1'),
  queda: CustomEase.create('lp-queda', 'M0,0 C0.25,0.46 0.36,1.18 0.56,1.1 0.7,1.04 0.82,0.99 1,1'),
};

function suportaWebGL2() {
  const contexto = document.createElement('canvas').getContext('webgl2');
  if (!contexto) return false;
  contexto.getExtension('WEBGL_lose_context')?.loseContext();
  return true;
}

/* O perfil "pleno" ganha a cena 3D e o scroll suave. O "leve" (toque, tela estreita, pouca CPU,
   economia de dados ou sem WebGL2) mantém a coreografia em DOM. O "reduzido" mostra tudo parado. */
export function perfilDeMovimento() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduzido';
  const ponteiroFino = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const telaLarga = matchMedia('(min-width: 960px)').matches;
  const economia = navigator.connection?.saveData === true;
  const nucleos = navigator.hardwareConcurrency ?? 4;
  return ponteiroFino && telaLarga && !economia && nucleos >= 4 && suportaWebGL2() ? 'pleno' : 'leve';
}

function ligarScrollSuave() {
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  const passo = (tempo) => lenis.raf(tempo * 1000);
  gsap.ticker.add(passo);
  gsap.ticker.lagSmoothing(0);
  return () => {
    gsap.ticker.remove(passo);
    gsap.ticker.lagSmoothing(500, 33);
    lenis.destroy();
  };
}

export function criarMotor(raiz, perfil) {
  const contexto = gsap.context(() => {}, raiz);
  const desfazer = [];
  if (perfil === 'pleno') desfazer.push(ligarScrollSuave());


  return {
    gsap, ScrollTrigger, SplitText, perfil,
    animado: perfil !== 'reduzido',
    ponteiroFino: matchMedia('(hover: hover) and (pointer: fine)').matches,

    no(funcao) { return contexto.add(funcao); },
    aoDesmontar(funcao) { desfazer.push(funcao); },

    atualizar() { ScrollTrigger.refresh(); },

    desmontar() {
      contexto.revert();
      for (const funcao of desfazer.splice(0).reverse()) funcao();
    },
  };
}

/* Efeito de ímã. O invólucro do botão segue o ponteiro dentro de um raio e volta com mola ao sair.
   Quem se move é o invólucro e não o botão, para o afundar do .btn continuar no CSS. */
export function magnetico(motor, involucro, { forca = 0.32 } = {}) {
  if (!motor.animado || !motor.ponteiroFino) return;
  const { gsap } = motor;
  const mover = (evento) => {
    const caixa = involucro.getBoundingClientRect();
    const distanciaX = evento.clientX - (caixa.left + caixa.width / 2);
    const distanciaY = evento.clientY - (caixa.top + caixa.height / 2);
    gsap.to(involucro, { x: distanciaX * forca, y: distanciaY * forca, duration: 0.5, ease: 'power3.out', overwrite: true });
  };
  const soltar = () => gsap.to(involucro, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.38)', overwrite: true });
  involucro.addEventListener('pointermove', mover);
  involucro.addEventListener('pointerleave', soltar);
  motor.aoDesmontar(() => {
    involucro.removeEventListener('pointermove', mover);
    involucro.removeEventListener('pointerleave', soltar);
    gsap.killTweensOf(involucro);
  });
}

/* Revela um título linha por linha, de dentro de uma máscara, quando ele entra na tela.
   autoSplit refaz as linhas quando a fonte termina de carregar ou a largura muda. */
export function revelarTitulo(motor, alvo, { gatilho = alvo, atraso = 0, comeco = 'top 82%' } = {}) {
  if (!motor.animado) return;
  const { gsap, SplitText } = motor;
  motor.no(() => {
    SplitText.create(alvo, {
      type: 'lines, words', mask: 'lines', linesClass: 'lp-linha', autoSplit: true,
      onSplit: (partes) => gsap.from(partes.words, {
        yPercent: 118, rotate: 4, duration: 1.15, ease: CURVAS.saida, stagger: 0.035, delay: atraso,
        scrollTrigger: { trigger: gatilho, start: comeco, once: true },
      }),
    });
  });
}

export function revelarTexto(motor, alvos, { gatilho, atraso = 0.15, comeco = 'top 80%' } = {}) {
  if (!motor.animado) return;
  const { gsap } = motor;
  motor.no(() => {
    gsap.from(alvos, {
      y: 26, autoAlpha: 0, duration: 1, ease: CURVAS.saida, stagger: 0.08, delay: atraso,
      scrollTrigger: { trigger: gatilho, start: comeco, once: true },
    });
  });
}
