/* Telas de Entrar e Criar conta. Cada uma é uma ficha com o formulário e o link para a outra
   tela. No cadastro, a regra da senha aparece como uma lista que vai sendo marcada enquanto a
   pessoa digita, e a confirmação avisa na hora se as senhas conferem. O servidor confere a regra
   de novo. O erro mostrado é o campo "erro" que vem da API. */
import { conta as apiConta } from '../api.js';
import { h, icone, logoMarca } from '../dom.js';
import { consumirDestino } from '../estado.js';
import { definirUsuario } from '../sessao.js';
import { campo, mostrarErroCampo, limparErroCampo } from './comum.js';

/* Mesma regra do validarSenha de Nucleo.Conta. Letra acentuada conta como letra, e símbolo é o
   que não é letra, número nem espaço. O limite de 72 bytes é checado só no servidor. */
const REGRAS = [
  { rotulo: '8 ou mais caracteres', cumpre: (senha) => [...senha].length >= 8 },
  { rotulo: 'uma letra maiúscula', cumpre: (senha) => /\p{Lu}/u.test(senha) },
  { rotulo: 'uma letra minúscula', cumpre: (senha) => /\p{Ll}/u.test(senha) },
  { rotulo: 'um número', cumpre: (senha) => /[0-9]/.test(senha) },
  { rotulo: 'um símbolo (! @ # ...)', cumpre: (senha) => /[^\p{L}\p{N}\s]/u.test(senha) },
];

function marca() {
  return h('a', { class: 'auth-marca', href: '#/', 'aria-label': 'Recall, início' }, logoMarca('auth-logo'));
}

function campoSenha(id, autocomplete) {
  const input = h('input', {
    class: 'input input-senha', id, name: id, type: 'password', autocomplete, required: true,
    maxlength: '72', spellcheck: 'false',
  });
  const alternar = h('button', {
    class: 'btn-icone senha-alternar', type: 'button', 'aria-label': 'Mostrar senha', 'aria-pressed': 'false',
  }, icone('olho'));
  alternar.addEventListener('click', () => {
    const mostrando = input.type === 'text';
    input.type = mostrando ? 'password' : 'text';
    alternar.setAttribute('aria-pressed', String(!mostrando));
    alternar.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Esconder senha');
    alternar.replaceChildren(icone(mostrando ? 'olho' : 'olhoRiscado'));
    input.focus();
  });
  input.addEventListener('input', () => limparErroCampo(input));
  return { input, controle: h('div', { class: 'senha-wrap' }, input, alternar) };
}

function campoTexto(id, tipo, autocomplete, extra = {}) {
  const input = h('input', { class: 'input', id, name: id, type: tipo, autocomplete, required: true, spellcheck: 'false', ...extra });
  input.addEventListener('input', () => limparErroCampo(input));
  return input;
}

/* validarLocal devolve [controle, mensagem] do primeiro problema, ou null. enviar chama a API. */
function telaDeConta(main, { titulo, subtitulo, campos, botao, validarLocal, enviar, troca }) {
  const erroGeral = h('p', { class: 'auth-erro', role: 'alert', hidden: true });
  const submeter = h('button', { class: 'btn btn-pri btn-alto btn-largo', type: 'submit' }, botao);
  const form = h('form', { class: 'auth-form', novalidate: true }, campos, erroGeral, submeter);

  form.addEventListener('input', () => { erroGeral.hidden = true; });
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    erroGeral.hidden = true;
    const problema = validarLocal();
    if (problema) {
      mostrarErroCampo(problema[0], problema[1]);
      return;
    }
    submeter.disabled = true;
    submeter.setAttribute('aria-busy', 'true');
    try {
      definirUsuario(await enviar());
      location.hash = consumirDestino() ?? '#/';
    } catch (erro) {
      erroGeral.textContent = erro.message;
      erroGeral.hidden = false;
      submeter.disabled = false;
      submeter.removeAttribute('aria-busy');
    }
  });

  main.append(h('section', { class: 'auth' },
    h('div', {},
      h('div', { class: 'auth-cartao ficha' },
        marca(),
        h('h1', { class: 'auth-titulo', tabindex: '-1' }, titulo),
        h('p', { class: 'auth-sub' }, subtitulo),
        form),
      h('p', { class: 'auth-troca' }, troca.texto, ' ', h('a', { href: troca.href }, troca.link)))));
  return form;
}

export async function renderEntrar(main) {
  document.title = 'Entrar · Recall';
  const email = campoTexto('entrar-email', 'email', 'username', { inputmode: 'email' });
  const senha = campoSenha('entrar-senha', 'current-password');

  const form = telaDeConta(main, {
    titulo: 'Bom te ver de novo',
    subtitulo: 'Entre para continuar de onde parou.',
    campos: [
      campo({ rotulo: 'E-mail', id: email.id, controle: email }),
      campo({ rotulo: 'Senha', id: senha.input.id, controle: senha.controle }),
    ],
    botao: 'Entrar',
    validarLocal: () => {
      if (!email.value.trim()) return [email, 'Informe seu e-mail'];
      if (!senha.input.value) return [senha.input, 'Informe sua senha'];
      return null;
    },
    enviar: () => apiConta.entrar({ email: email.value, senha: senha.input.value }),
    troca: { texto: 'Ainda não tem conta?', link: 'Criar conta', href: '#/criar-conta' },
  });
  form.querySelector('input').focus();
  return () => { document.title = 'Recall'; };
}

export async function renderCriarConta(main) {
  document.title = 'Criar conta · Recall';
  const nome = campoTexto('conta-nome', 'text', 'name', { maxlength: '80' });
  const email = campoTexto('conta-email', 'email', 'email', { inputmode: 'email' });
  const senha = campoSenha('conta-senha', 'new-password');
  const confirmacao = campoSenha('conta-confirmar', 'new-password');

  const itens = REGRAS.map((regra) => h('li', { class: 'regra' },
    h('span', { class: 'regra-marca', 'aria-hidden': 'true' }, icone('check')),
    h('span', {}, regra.rotulo)));
  const regras = h('ul', { class: 'regras', id: 'conta-senha-regras', 'aria-label': 'A senha precisa de' }, itens);
  const confere = h('p', { class: 'confere', id: 'conta-confirmar-confere', 'aria-live': 'polite', hidden: true });
  senha.input.setAttribute('aria-describedby', regras.id);

  function atualizarRegras() {
    REGRAS.forEach((regra, i) => {
      const ok = regra.cumpre(senha.input.value);
      itens[i].classList.toggle('ok', ok);
      itens[i].setAttribute('aria-label', `${regra.rotulo}: ${ok ? 'cumprido' : 'falta'}`);
    });
  }
  /* Só avisa que as senhas são diferentes depois que a confirmação chega no tamanho da senha.
     No meio da digitação elas sempre são diferentes, e o aviso vermelho cedo demais parece erro. */
  function atualizarConfere() {
    const igual = confirmacao.input.value === senha.input.value;
    if (!confirmacao.input.value || (!igual && confirmacao.input.value.length < senha.input.value.length)) {
      confere.hidden = true;
      return;
    }
    confere.hidden = false;
    confere.className = igual ? 'confere certo' : 'confere errado';
    confere.replaceChildren(icone(igual ? 'check' : 'fechar'), igual ? 'As senhas conferem' : 'As senhas não conferem');
  }
  senha.input.addEventListener('input', () => { atualizarRegras(); atualizarConfere(); });
  confirmacao.input.addEventListener('input', atualizarConfere);

  const form = telaDeConta(main, {
    titulo: 'Crie sua conta',
    subtitulo: 'Seus baralhos, cartões e revisões ficam guardados nela.',
    campos: [
      campo({ rotulo: 'Nome', id: nome.id, controle: nome }),
      campo({ rotulo: 'E-mail', id: email.id, controle: email }),
      h('div', { class: 'campo' },
        h('label', { class: 'campo-rotulo', for: senha.input.id }, 'Senha'),
        senha.controle,
        regras,
        h('p', { class: 'campo-erro', id: `${senha.input.id}-erro`, role: 'alert', hidden: true })),
      h('div', { class: 'campo' },
        h('label', { class: 'campo-rotulo', for: confirmacao.input.id }, 'Confirme a senha'),
        confirmacao.controle,
        confere,
        h('p', { class: 'campo-erro', id: `${confirmacao.input.id}-erro`, role: 'alert', hidden: true })),
    ],
    botao: 'Criar conta',
    validarLocal: () => {
      if (!nome.value.trim()) return [nome, 'Informe seu nome'];
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return [email, 'Confira o e-mail'];
      const falta = REGRAS.find((regra) => !regra.cumpre(senha.input.value));
      if (falta) return [senha.input, `A senha precisa de ${falta.rotulo.replace(' (! @ # ...)', '')}`];
      if (confirmacao.input.value !== senha.input.value) return [confirmacao.input, 'As senhas não conferem'];
      return null;
    },
    enviar: () => apiConta.criar({ nome: nome.value, email: email.value, senha: senha.input.value }),
    troca: { texto: 'Já tem conta?', link: 'Entrar', href: '#/entrar' },
  });
  atualizarRegras();
  form.querySelector('input').focus();
  return () => { document.title = 'Recall'; };
}
