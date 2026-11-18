/* Cartões em arquivo de texto: uma carta por linha, frente e verso separados. Exporta em CSV com
   ponto e vírgula (o separador do Excel em português) ou em TXT com tabulação (o do Anki). Campo
   com separador, aspas ou quebra de linha vai entre aspas, com aspas dobradas por dentro. */

export const FORMATOS = {
  csv: { separador: ';', extensao: 'csv', tipo: 'text/csv;charset=utf-8', nome: 'CSV para Excel e planilhas' },
  txt: { separador: '\t', extensao: 'txt', tipo: 'text/plain;charset=utf-8', nome: 'TXT com tabulação, para o Anki' },
};

function campo(texto, separador) {
  return /["\r\n]/.test(texto) || texto.includes(separador) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

/* O Excel só lê acento num CSV em UTF-8 quando o arquivo começa com a marca BOM. */
export function gerarArquivo(cartoes, formato) {
  const { separador } = FORMATOS[formato];
  const corpo = cartoes.map((cartao) => `${campo(cartao.frente, separador)}${separador}${campo(cartao.verso, separador)}`).join('\r\n');
  return `${formato === 'csv' ? '﻿' : ''}${corpo}\r\n`;
}

function registros(texto, separador) {
  const saida = [];
  let registro = [];
  let atual = '';
  let entreAspas = false;
  for (let i = 0; i < texto.length; i += 1) {
    const caractere = texto[i];
    if (entreAspas) {
      if (caractere !== '"') atual += caractere;
      else if (texto[i + 1] === '"') { atual += '"'; i += 1; }
      else entreAspas = false;
    } else if (caractere === '"' && atual === '') entreAspas = true;
    else if (caractere === separador) { registro.push(atual); atual = ''; }
    else if (caractere === '\n' || caractere === '\r') {
      if (caractere === '\r' && texto[i + 1] === '\n') i += 1;
      registro.push(atual);
      saida.push(registro);
      registro = [];
      atual = '';
    } else atual += caractere;
  }
  if (atual !== '' || registro.length) {
    registro.push(atual);
    saida.push(registro);
  }
  return saida;
}

/* O separador é o primeiro que aparece na primeira linha com conteúdo: tabulação, ponto e vírgula
   ou vírgula, nessa ordem de preferência. */
function separadorDe(linhas) {
  const amostra = linhas.find((linha) => linha.trim() && !linha.startsWith('#')) ?? '';
  return ['\t', ';', ','].find((candidato) => amostra.includes(candidato)) ?? null;
}

const CABECALHOS = new Set(['frente', 'front', 'pergunta', 'question']);

/* Lê o texto de um arquivo e devolve um item por registro: { frente, verso, valida: true } ou
   { linha, valida: false } quando falta um dos lados. Colunas além da segunda (etiquetas do Anki)
   são ignoradas; linhas de configuração do Anki (#separator:tab, #html:true) e um cabeçalho
   frente/verso na primeira linha também. */
export function lerArquivo(texto) {
  const limpo = texto.replace(/^﻿/, '');
  const linhas = limpo.split(/\r?\n/);
  const separador = separadorDe(linhas);
  const semConfig = linhas.filter((linha) => !/^#[a-z ]+:/i.test(linha)).join('\n');
  const lidos = separador ? registros(semConfig, separador) : semConfig.split('\n').map((linha) => [linha]);
  const itens = lidos
    .filter((registro) => registro.some((coluna) => coluna.trim()))
    .map((registro) => {
      const frente = (registro[0] ?? '').trim();
      const verso = (registro[1] ?? '').trim();
      return frente && verso ? { frente, verso, valida: true } : { linha: registro.join(separador ?? '').trim(), valida: false };
    });
  const primeiro = itens[0];
  if (primeiro?.valida && CABECALHOS.has(primeiro.frente.toLowerCase())) itens.shift();
  return itens;
}

export function nomeDeArquivo(base, formato) {
  const slug = base.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cartoes';
  return `${slug}.${FORMATOS[formato].extensao}`;
}
