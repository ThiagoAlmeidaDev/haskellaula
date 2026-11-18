/* Texto e dados da landing, separados da montagem e do movimento. Nada aqui chama a API. */

export const HEROI = {
  titulo: 'Cartas que voltam na hora certa',
  sub: 'Escreva perguntas e respostas, estude alguns minutos por dia e o Recall traz cada carta de volta pouco antes de você esquecer.',
};

export const MACO = [
  { baralho: 'Japonês', cor: 'chiclete', padrao: 'bolinhas', pergunta: 'Como se diz “gato”?', resposta: '猫 neko' },
  { baralho: 'Capitais', cor: 'sol', padrao: 'listras', pergunta: 'Capital da Austrália?', resposta: 'Camberra' },
  { baralho: 'Química', cor: 'hortela', padrao: 'xadrez', pergunta: 'Símbolo do ouro?', resposta: 'Au' },
  { baralho: 'Anatomia', cor: 'tomate', padrao: 'liso', pergunta: 'Maior osso do corpo?', resposta: 'Fêmur' },
  { baralho: 'Física', cor: 'ceu', padrao: 'bolinhas', pergunta: 'Velocidade da luz?', resposta: '300 mil km/s' },
  { baralho: 'Literatura', cor: 'cobalto', padrao: 'liso', pergunta: 'Autor de Dom Casmurro?', resposta: 'Machado de Assis' },
  { baralho: 'História', cor: 'terra', padrao: 'listras', pergunta: 'Revolução Francesa?', resposta: '1789' },
  { baralho: 'Francês', cor: 'grafite', padrao: 'xadrez', pergunta: 'Bonjour', resposta: 'bom dia' },
  { baralho: 'Matemática', cor: 'cobalto', padrao: 'bolinhas', pergunta: '√144', resposta: '12' },
];

export const ESQUECIMENTO = {
  frase: 'Sem revisão, o que você estuda hoje começa a sumir já no dia seguinte.',
  titulo: 'Cada revisão chega pouco antes do esquecimento',
  texto: 'O Recall usa o SM-2, um algoritmo de repetição espaçada. Depois de cada acerto a carta demora mais para voltar, e você não gasta tempo com o que já sabe.',
  semRevisao: 'sem revisão',
  comRecall: 'com o Recall',
  fecho: '4 revisões em 60 dias',
};

/* Dias de revisão de um cartão segundo o SM-2. Respondendo sempre "Bom", ele volta nos dias 1, 7, 22
   e 60. Se errar no dia 7, a facilidade cai para 1,96 e o cartão volta nos dias 8, 9, 15, 27 e 51. */
export const REVISOES_BOM = [1, 7, 22, 60];

export const CENARIOS = {
  bom: { dias: REVISOES_BOM, erro: null, texto: '4 revisões em 60 dias. Sem espaçamento seriam 60.' },
  erro: { dias: [1, 7, 8, 9, 15, 27, 51], erro: 7, texto: 'Errou no dia 7: a carta volta no dia seguinte e os intervalos recomeçam, mais curtos.' },
};

export const SESSAO = {
  titulo: 'Uma sessão, carta por carta',
  carta: { baralho: 'Capitais', cor: 'sol', padrao: 'listras', pergunta: 'Capital da Austrália?', resposta: 'Camberra' },
  passos: [
    { titulo: 'Escreva a pergunta', texto: 'Frente e verso, com as suas palavras. Dá para colar uma lista inteira de uma vez.' },
    { titulo: 'Vire e diga como foi', texto: 'Errei, Difícil, Bom ou Fácil. No teclado, Espaço vira a carta e 1 a 4 respondem.' },
    { titulo: 'A carta volta sozinha', texto: 'Errou, ela volta amanhã. Acertou, demora cada vez mais para aparecer de novo.' },
  ],
  respostas: [
    { rotulo: 'Errei', classe: 'resposta-errei', tecla: '1' },
    { rotulo: 'Difícil', classe: 'resposta-dificil', tecla: '2' },
    { rotulo: 'Bom', classe: 'resposta-bom', tecla: '3' },
    { rotulo: 'Fácil', classe: 'resposta-facil', tecla: '4' },
  ],
  trilho: [
    { dia: 0, rotulo: 'hoje' },
    { dia: 1, rotulo: 'amanhã' },
    { dia: 7, rotulo: 'dia 7' },
    { dia: 22, rotulo: 'dia 22' },
    { dia: 60, rotulo: 'dia 60' },
  ],
};

export const CALENDARIO = {
  titulo: 'Cada acerto empurra a carta para mais longe',
  texto: 'Cada cor é um baralho. Passe o mouse ou toque num dia para ver as cartas que voltam nele, ou compare os dois caminhos de uma carta só.',
  exemplos: 'Seis cartas, criadas em dias diferentes, acertadas sempre. Toque num dia para ver quais voltam.',
};

/* Cartas de exemplo do calendário. inicio é há quantos dias a carta foi criada. Ela volta nos dias
   de REVISOES_BOM contados da criação, e só os que caem entre amanhã e o dia 69 aparecem. */
export const EXEMPLOS_CALENDARIO = [
  { baralho: 'Japonês', cor: 'chiclete', pergunta: 'Como se diz “gato”?', inicio: 0 },
  { baralho: 'Física', cor: 'ceu', pergunta: 'Velocidade da luz?', inicio: 1 },
  { baralho: 'Capitais', cor: 'sol', pergunta: 'Capital da Austrália?', inicio: 3 },
  { baralho: 'Química', cor: 'hortela', pergunta: 'Símbolo do ouro?', inicio: 6 },
  { baralho: 'Anatomia', cor: 'tomate', pergunta: 'Maior osso do corpo?', inicio: 10 },
  { baralho: 'Literatura', cor: 'cobalto', pergunta: 'Autor de Dom Casmurro?', inicio: 15 },
];

export const LETREIRO = [
  ['Capital do Canadá?', 'Ottawa'], ['水', 'água'], ['Mitocôndria?', 'gera energia na célula'],
  ['1789', 'Revolução Francesa'], ['“Thank you”', 'obrigado'], ['√144', '12'],
  ['Autor de Dom Casmurro?', 'Machado de Assis'], ['H₂O', 'água'], ['Maior planeta?', 'Júpiter'],
  ['Fotossíntese usa?', 'luz, água e CO₂'], ['Bonjour', 'bom dia'], ['Lei de Ohm', 'V = R · I'],
];

export const JEITO = {
  titulo: 'Do seu jeito, carta por carta',
  texto: 'Cada baralho tem sua cor e estampa. A letra pode crescer, a resposta pode virar a carta ou aparecer embaixo, e a pergunta fica ou some. Tudo fica salvo na sua conta.',
  carta: { pergunta: 'Como se diz “obrigado” em japonês?', resposta: 'ありがとう (arigatō)', rotuloEsq: 'Japonês', rotuloDir: 'Exemplo' },
};

export const FINAL = {
  titulo: 'Seu primeiro baralho leva um minuto',
  texto: 'Crie a conta, escolha a capa do baralho e escreva ou cole as primeiras cartas. Elas entram na revisão de hoje.',
};
