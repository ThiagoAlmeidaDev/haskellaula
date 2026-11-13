/* Do seu jeito: a carta de exemplo muda ao vivo com os mesmos controles da tela de preferências.
   Cada mudança dá um toque na carta, para o olho ligar o controle ao efeito. */
import { h, icone, kbd } from '../../dom.js';
import { PREFERENCIAS_PADRAO } from '../../sessao.js';
import { cartaEstudo, chave, faixaTamanho, seletorCor, seletorOpcoes, seletorPadrao } from '../../views/componentes.js';
import { JEITO } from '../conteudo.js';
import { CURVAS, revelarTexto, revelarTitulo } from '../movimento.js';

export function jeito() {
  let prefs = { ...PREFERENCIAS_PADRAO };
  let capa = { cor: 'chiclete', padrao: 'bolinhas' };
  let tocar = () => {};
  const carta = cartaEstudo({ ...JEITO.carta, ...capa, prefs });
  const mudar = (m) => {
    prefs = { ...prefs, ...m };
    carta.aplicar(prefs);
    tocar();
  };
  const mudarCapa = (m) => {
    capa = { ...capa, ...m };
    carta.capa(capa.cor, capa.padrao);
    tocar();
  };
  const padrao = seletorPadrao({ valor: capa.padrao, cor: capa.cor, aoMudar: (v) => mudarCapa({ padrao: v }) });
  const cor = seletorCor({ valor: capa.cor, aoMudar: (v) => { padrao.mudarCor(v); mudarCapa({ cor: v }); } });
  const virar = h('button', { class: 'btn btn-sol', type: 'button' });
  const rotular = () => virar.replaceChildren(icone('virar'), carta.revelada ? 'Esconder a resposta' : 'Mostrar a resposta');
  virar.addEventListener('click', () => { carta.alternar(); rotular(); });
  carta.el.addEventListener('click', () => { carta.alternar(); rotular(); });
  rotular();

  const controles = [
    cor.el,
    padrao.el,
    faixaTamanho({ rotulo: 'Tamanho do texto', valor: 3, aoMudar: (v) => mudar({ tamanhoPergunta: v, tamanhoResposta: v }) }).el,
    seletorOpcoes({
      legenda: 'Fonte', nome: 'fonte-lp', valor: 'sem-serifa', aoMudar: (v) => mudar({ fonte: v }),
      itens: [
        { valor: 'sem-serifa', nome: 'Sem serifa' },
        { valor: 'serifa', nome: 'Serifa', estilo: 'font-family: var(--fonte-serifa); font-size: 17px' },
        { valor: 'manuscrita', nome: 'À mão', estilo: 'font-family: var(--fonte-mao); font-size: 19px; font-weight: 400' },
      ],
    }).el,
    seletorOpcoes({
      legenda: 'Ao mostrar a resposta', nome: 'revelar-lp', valor: 'virar', aoMudar: (v) => mudar({ revelar: v }),
      itens: [{ valor: 'virar', nome: 'Virar a carta' }, { valor: 'abaixo', nome: 'Mostrar embaixo' }],
    }).el,
    chave({ rotulo: 'Manter a pergunta depois de revelar', valor: true, aoMudar: (v) => mudar({ mostrarPergunta: v }) }).el,
  ];
  const titulo = h('h2', { class: 'lp-h2', id: 'lp-jeito' }, JEITO.titulo);
  const texto = h('p', { class: 'lp-paragrafo' }, JEITO.texto);
  const lado = h('div', { class: 'jeito-carta' },
    carta.el,
    h('div', { class: 'estudo-acoes mostrar' }, virar,
      h('span', { class: 'dica' }, 'No estudo: ', kbd('Espaço'), ' vira, ', kbd('1'), ' a ', kbd('4'), ' respondem')));

  const el = h('section', { class: 'lp-sec lp-jeito', dataset: { tom: 'claro' }, 'aria-labelledby': 'lp-jeito' },
    h('div', { class: 'lp-wrap jeito' },
      h('div', {}, titulo, texto, h('div', { class: 'jeito-controles' }, controles)),
      lado));

  function animar(motor) {
    revelarTitulo(motor, titulo);
    revelarTexto(motor, [texto, ...controles], { gatilho: titulo });
    if (!motor.animado) return;
    const { gsap } = motor;
    tocar = () => gsap.fromTo(carta.el, { scale: 0.965, rotate: -1.2 }, { scale: 1, rotate: 0, duration: 0.6, ease: CURVAS.mola, overwrite: true });
    motor.aoDesmontar(() => { tocar = () => {}; });
    motor.no(() => {
      gsap.from(lado, {
        y: 80, rotate: 5, autoAlpha: 0, duration: 1.2, ease: CURVAS.saida,
        scrollTrigger: { trigger: el, start: 'top 70%', once: true },
      });
    });
  }

  return { el, animar };
}
