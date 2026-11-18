/* Gaveta lateral compartilhada: criar e editar baralho e cartão sem sair da página. Usa o
   dialog.gaveta do index.html em modo modal, então Esc fecha e o foco volta para quem abriu. */
import { h } from './dom.js';

const dialogo = () => document.querySelector('dialog.gaveta');

let aoFecharAtual = null;
let origemFoco = null;

export function fecharGaveta() {
  const el = dialogo();
  if (el.open) el.close();
}

function aoFechar() {
  const callback = aoFecharAtual;
  aoFecharAtual = null;
  dialogo().querySelector('.gaveta-conteudo').replaceChildren();
  if (origemFoco instanceof HTMLElement && origemFoco.isConnected) origemFoco.focus();
  if (typeof callback === 'function') callback();
}

/* corpo e rodape são nós do DOM. O form envolve os dois para que Enter e o botão de envio
   funcionem do mesmo jeito. aoEnviar recebe o evento já com preventDefault. */
export function abrirGaveta({ titulo, corpo, rodape, aoEnviar, aoFechar: callback }) {
  const el = dialogo();
  if (el.open) el.close();
  origemFoco = document.activeElement;
  aoFecharAtual = callback ?? null;
  el.querySelector('.gaveta-titulo').textContent = titulo;
  const form = h('form', { class: 'gaveta-form', novalidate: true },
    h('div', { class: 'gaveta-corpo' }, corpo),
    rodape ? h('footer', { class: 'gaveta-rodape' }, rodape) : null);
  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (aoEnviar) aoEnviar(evento);
  });
  el.querySelector('.gaveta-conteudo').replaceChildren(form);
  el.showModal();
  const primeiro = form.querySelector('input, textarea, select');
  if (primeiro) primeiro.focus();
  return { form, fechar: fecharGaveta };
}

export function iniciarGaveta() {
  const el = dialogo();
  el.addEventListener('close', aoFechar);
  el.querySelector('[data-acao="fechar-gaveta"]').addEventListener('click', fecharGaveta);
  el.addEventListener('click', (evento) => {
    if (evento.target === el) fecharGaveta();
  });
}
