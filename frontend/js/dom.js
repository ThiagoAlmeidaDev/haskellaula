/* Utilitários de DOM e de texto que toda view usa: h() e svg() para montar elementos sem HTML
   em string, ícones SVG próprios, datas no dia local, plural, toast e diálogo de confirmação. */
const SVG_NS = 'http://www.w3.org/2000/svg';

function aplicarAtributos(el, attrs) {
  for (const [chave, valor] of Object.entries(attrs)) {
    if (valor === false || valor === null || valor === undefined) continue;
    if (chave === 'class') el.setAttribute('class', valor);
    else if (chave === 'text') el.textContent = valor;
    else if (chave === 'dataset') Object.assign(el.dataset, valor);
    else if (chave.startsWith('on') && typeof valor === 'function') {
      el.addEventListener(chave.slice(2).toLowerCase(), valor);
    } else if (valor === true) el.setAttribute(chave, '');
    else el.setAttribute(chave, String(valor));
  }
}

function anexar(el, filhos) {
  for (const filho of filhos.flat(Infinity)) {
    if (filho === null || filho === undefined || filho === false) continue;
    el.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
}

/* Todo texto vindo da API entra como nó de texto. Nenhuma view monta HTML por string,
   porque frente e verso são escritos pelo usuário e podem conter marcação. */
export function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  aplicarAtributos(el, attrs);
  anexar(el, filhos);
  return el;
}

export function svg(tag, attrs = {}, ...filhos) {
  const el = document.createElementNS(SVG_NS, tag);
  aplicarAtributos(el, attrs);
  anexar(el, filhos);
  return el;
}

const ICONES = {
  lixo: ['M3 4.5h10', 'M6.5 4.5V3h3v1.5', 'M4.5 4.5l.6 8.5h5.8l.6-8.5'],
  lapis: ['M10.5 2.75l2.75 2.75L6 12.75H3.25V10z'],
  voltar: ['M9.5 3.5 5 8l4.5 4.5'],
  mais: ['M8 3.5v9', 'M3.5 8h9'],
  fechar: ['m4 4 8 8', 'm12 4-8 8'],
  grafico: ['M3 13V9', 'M8 13V3', 'M13 13V6'],
  alerta: ['M8 2.75 14 13H2z', 'M8 7v2.5', 'M8 11.25v.01'],
  olho: ['M1.75 8S4 3.75 8 3.75 14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8z', 'M8 6.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5z'],
  olhoRiscado: ['M1.75 8S4 3.75 8 3.75 14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8z', 'm2.5 2.5 11 11'],
  check: ['m3.5 8.25 3 3 6-6.5'],
  busca: ['M7 2.75a4.25 4.25 0 1 0 0 8.5 4.25 4.25 0 0 0 0-8.5z', 'm10.25 10.25 3 3'],
  pular: ['m3.5 4 4 4-4 4', 'm8.5 4 4 4-4 4'],
  seta: ['M3 8h10', 'm9 4 4 4-4 4'],
  lista: ['M5.5 4.5h7.5', 'M5.5 8h7.5', 'M5.5 11.5h7.5', 'M2.75 4.5h.01', 'M2.75 8h.01', 'M2.75 11.5h.01'],
  baralho: ['M3 5.5h10v7.5H3z', 'M4.5 3h7'],
  ajustes: ['M3 4.5h6', 'M12 4.5h1', 'M10.5 3v3', 'M3 11.5h1', 'M7 11.5h6', 'M5.5 10v3'],
  virar: ['M2.75 8a5.25 5.25 0 0 1 9.4-3.2', 'M12.5 2.5v2.5H10', 'M13.25 8a5.25 5.25 0 0 1-9.4 3.2', 'M3.5 13.5V11H6'],
  baixar: ['M8 2.75v7.5', 'm4.75 7 3.25 3.25L11.25 7', 'M3 13.25h10'],
  subir: ['M8 10.25v-7.5', 'm4.75 6 3.25-3.25L11.25 6', 'M3 13.25h10'],
};

export function icone(nome) {
  return svg('svg', { class: 'icon', viewBox: '0 0 16 16', 'aria-hidden': 'true' },
    ICONES[nome].map((caminho) => svg('path', { d: caminho })));
}

// Logo do Recall. São duas cartas, a de trás amarela e inclinada e a da frente cobalto com o R.
export function logoMarca(classe = 'logo-mark') {
  return svg('svg', { class: classe, viewBox: '0 0 40 40', 'aria-hidden': 'true' },
    svg('rect', { x: '5', y: '8', width: '22', height: '28', rx: '5', transform: 'rotate(-14 16 22)', fill: 'var(--sol)', stroke: '#000', 'stroke-width': '2.5' }),
    svg('rect', { x: '13', y: '5', width: '22', height: '28', rx: '5', fill: 'var(--cobalto)', stroke: '#000', 'stroke-width': '2.5' }),
    svg('path', { d: 'M20 25V13h4.5a3.5 3.5 0 0 1 0 7H20m4 0 4 5', fill: 'none', stroke: '#fff', 'stroke-width': '2.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

/* O download é feito por um link temporário que aponta para um Blob, e o endereço é liberado logo depois do clique. */
export function baixarArquivo(nome, texto, tipo) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const link = h('a', { href: url, download: nome, hidden: true });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function kbd(texto) {
  return h('kbd', {}, texto);
}

export function plural(quantidade, singular, pluralForma) {
  return `${formatarNumero(quantidade)} ${quantidade === 1 ? singular : pluralForma}`;
}

const numero = new Intl.NumberFormat('pt-BR');
export function formatarNumero(valor) {
  return numero.format(valor);
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/* A API manda datas como dia local "YYYY-MM-DD". new Date(texto) leria como meia-noite UTC,
   que no Brasil cai no dia anterior; por isso a data é montada com o construtor local. */
export function lerDia(texto) {
  const [ano, mes, dia] = texto.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

export function hojeLocal() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

export function diasAte(texto) {
  return Math.round((lerDia(texto) - hojeLocal()) / 86400000);
}

export function diaCurto(texto) {
  const data = lerDia(texto);
  return `${data.getDate()} ${MESES[data.getMonth()]}`;
}

export function diaDaSemana(texto) {
  return DIAS_SEMANA[lerDia(texto).getDay()];
}

// Prazo em dias, como aparece embaixo de cada resposta e no retorno depois dela.
export function prazo(dias) {
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias < 60) return `${dias} dias`;
  return `${Math.round(dias / 30)} meses`;
}

export function quandoRevisar(texto) {
  const dias = diasAte(texto);
  if (dias < 0) return `atrasado desde ${diaCurto(texto)}`;
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return `em ${dias} dias (${diaCurto(texto)})`;
}

export function digitando(evento) {
  const alvo = evento.target;
  return alvo instanceof HTMLElement
    && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName));
}

export function semAcento(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export const ehMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const regiaoToasts = () => document.querySelector('.toasts');

export function toast(mensagem, { tipo = 'erro', duracao = 6000 } = {}) {
  const fechar = () => {
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 180);
  };
  const el = h('div', { class: `toast toast-${tipo}`, role: tipo === 'erro' ? 'alert' : 'status' },
    tipo === 'erro' ? icone('alerta') : null,
    h('p', { class: 'toast-texto' }, mensagem),
    h('button', { class: 'btn-icone', type: 'button', 'aria-label': 'Fechar aviso', onclick: fechar },
      icone('fechar')));
  regiaoToasts().append(el);
  setTimeout(fechar, duracao);
}

export function confirmar({ titulo, texto, acao }) {
  const dialogo = document.querySelector('dialog.confirmar');
  dialogo.querySelector('.confirmar-titulo').textContent = titulo;
  dialogo.querySelector('.confirmar-texto').textContent = texto;
  const botaoOk = dialogo.querySelector('button[value="ok"]');
  const botaoCancelar = dialogo.querySelector('button[value="cancelar"]');
  botaoOk.textContent = acao;
  const origem = document.activeElement;

  return new Promise((resolver) => {
    const terminar = (resultado) => {
      botaoOk.removeEventListener('click', aoOk);
      botaoCancelar.removeEventListener('click', aoCancelar);
      dialogo.removeEventListener('close', aoFechar);
      if (dialogo.open) dialogo.close();
      if (origem instanceof HTMLElement && origem.isConnected) origem.focus();
      resolver(resultado);
    };
    const aoOk = () => terminar(true);
    const aoCancelar = () => terminar(false);
    const aoFechar = () => terminar(false);
    botaoOk.addEventListener('click', aoOk);
    botaoCancelar.addEventListener('click', aoCancelar);
    dialogo.addEventListener('close', aoFechar);
    dialogo.showModal();
    botaoCancelar.focus();
  });
}
