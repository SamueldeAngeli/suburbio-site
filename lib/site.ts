// Substitua os valores abaixo pelos canais oficiais da cidade.
export const site = { discordUrl: 'https://discord.gg/suburbiorp', connectUrl: '', storeLive: false };
export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  tag: string;
  description: string;
  features: string[];
  level: number;
  validityMode: 'PERMANENT' | 'DURATION';
  durationDays: number | null;
  renewable: boolean;
};
// Catálogo de demonstração: confirme valores e benefícios antes de ativar vendas.
export const products: Product[] = [
  {
    id: 'cria',
    validityMode: 'DURATION',
    durationDays: 30,
    renewable: true,
    name: 'VIP Cria',
    category: 'VIPs',
    price: 29.9,
    tag: 'SEU PRIMEIRO PASSO',
    description: 'Um começo com a sua cara. Para quem está chegando e quer fazer parte da quebrada.',
    features: ['Cargo exclusivo na comunidade', 'Identificação VIP no perfil', 'Vigência de 30 dias'],
    level: 1,
  },
  {
    id: 'patrao',
    validityMode: 'DURATION',
    durationDays: 30,
    renewable: true,
    name: 'VIP Patrão',
    category: 'VIPs',
    price: 59.9,
    tag: 'PRESENÇA DE RESPEITO',
    description: 'Deixe sua marca na cidade e fortaleça a comunidade que você escolheu chamar de casa.',
    features: ['Benefícios do VIP Cria', 'Personalização visual exclusiva', 'Vigência de 30 dias'],
    level: 2,
  },
  {
    id: 'lenda',
    validityMode: 'DURATION',
    durationDays: 30,
    renewable: true,
    name: 'VIP Lenda',
    category: 'VIPs',
    price: 99.9,
    tag: 'ESCREVA SEU LEGADO',
    description: 'Para quem vive cada história intensamente. A expressão máxima da sua identidade no Subúrbio.',
    features: ['Benefícios do VIP Patrão', 'Distintivo especial de apoiador', 'Vigência de 30 dias'],
    level: 3,
  },
  {
    id: 'comet',
    validityMode: 'DURATION',
    durationDays: 30,
    renewable: true,
    name: 'Comet RS',
    category: 'Carros',
    price: 149.9,
    tag: 'PRESENÇA NO ASFALTO',
    description: 'Um esportivo para transformar cada chegada em um acontecimento. Veículo fictício de demonstração.',
    features: ['Um veículo para seu personagem', 'Personalização visual na garagem', 'Entrega e regras a definir'],
    level: 4,
  },
  {
    id: 'sultan',
    validityMode: 'DURATION',
    durationDays: 30,
    renewable: true,
    name: 'Sultan Street',
    category: 'Carros',
    price: 89.9,
    tag: 'FEITO PARA O SEU CORRE',
    description:
      'Estilo de rua e personalidade para acompanhar a sua rotina na cidade. Veículo fictício de demonstração.',
    features: ['Um veículo para seu personagem', 'Visual inspirado na cultura de rua', 'Entrega e regras a definir'],
    level: 5,
  },
  {
    id: 'loft',
    validityMode: 'DURATION',
    durationDays: 30,
    renewable: true,
    name: 'Loft Urbano',
    category: 'Casas',
    price: 199.9,
    tag: 'SEU CANTO NA CIDADE',
    description:
      'Um espaço para chamar de seu, receber a família e planejar os próximos capítulos. Imóvel fictício de demonstração.',
    features: [
      'Um imóvel para seu personagem',
      'Interior com proposta urbana',
      'Localização e disponibilidade a definir',
    ],
    level: 6,
  },
  {
    id: 'cobertura',
    validityMode: 'DURATION',
    durationDays: 30,
    renewable: true,
    name: 'Cobertura Skyline',
    category: 'Casas',
    price: 349.9,
    tag: 'A CIDADE AOS SEUS PÉS',
    description:
      'Um novo ponto de vista sobre o Subúrbio. Uma cobertura para quem quer construir seu legado. Imóvel fictício de demonstração.',
    features: [
      'Uma cobertura para seu personagem',
      'Ambiente de convivência exclusivo',
      'Localização e disponibilidade a definir',
    ],
    level: 7,
  },
  {
    id: 'identidade',
    validityMode: 'PERMANENT',
    durationDays: null,
    renewable: false,
    name: 'Nova identidade',
    category: 'Itens VIP',
    price: 19.9,
    tag: 'UM NOVO CAPÍTULO',
    description: 'Uma nova forma de se apresentar à cidade, respeitando a história do seu personagem.',
    features: ['Uma alteração de nome do personagem', 'Sujeito às regras da cidade', 'Aplicação pela equipe'],
    level: 0,
  },
];
