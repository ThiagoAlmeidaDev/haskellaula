/* Peças repetidas entre as views: estado de erro com toast, link de voltar, esqueletos de
   carregamento e o campo de formulário com mensagem de erro ligada por aria-describedby. */
import { h, icone, toast } from '../dom.js';

export function abortado(erro) {
  return erro?.name === 'AbortError';
}

export function estadoErro(alvo, erro) {
  const tentarDeNovo = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  toast(erro.message);
  const titulo = erro.status === 404 ? 'Não encontrado' : 'Não foi possível carregar';
  alvo.replaceChildren(h('section', { class: 'estado' },
    h('h1', { class: 'estado-titulo', tabindex: '-1' }, titulo),
    h('p', { class: 'estado-texto' }, erro.message),
    h('div', { class: 'estado-acoes' },
      erro.status === 404
        ? h('a', { class: 'btn btn-pri', href: '#/' }, 'Ir para os baralhos')
        : h('button', { class: 'btn btn-pri', type: 'button', onclick: tentarDeNovo }, 'Tentar de novo'))));
}

export function voltar(href, texto) {
  return h('a', { class: 'voltar', href }, icone('voltar'), texto);
}

export function esqueleto(classe, quantidade) {
  return Array.from({ length: quantidade }, () => h('div', { class: `esqueleto ${classe}`, 'aria-hidden': 'true' }));
}

export function campo({ rotulo, id, controle, ajuda }) {
  return h('div', { class: 'campo' },
    h('label', { class: 'campo-rotulo', for: id }, rotulo),
    controle,
    ajuda ? h('p', { class: 'campo-ajuda', id: `${id}-ajuda` }, ajuda) : null,
    h('p', { class: 'campo-erro', id: `${id}-erro`, role: 'alert', hidden: true }));
}

export function mostrarErroCampo(controle, mensagem) {
  const el = document.getElementById(`${controle.id}-erro`);
  el.textContent = mensagem;
  el.hidden = false;
  controle.setAttribute('aria-invalid', 'true');
  controle.setAttribute('aria-describedby', el.id);
  controle.focus();
}

export function limparErroCampo(controle) {
  const el = document.getElementById(`${controle.id}-erro`);
  if (!el) return;
  el.hidden = true;
  controle.removeAttribute('aria-invalid');
  controle.removeAttribute('aria-describedby');
}
