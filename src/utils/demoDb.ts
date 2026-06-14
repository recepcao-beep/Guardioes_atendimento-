import { 
  Sector, Profile, Platform, ReviewInvite, ReviewEvent, 
  InternalReview, ExternalReviewConfirmation, MonthlyPrize, 
  AuditLog, InviteStatus, PlatformCode, Complaint, ComplaintStatus
} from '../types';

// Helper to get formatted dates
const getPastDateString = (daysAgo: number, timeStr = '14:30:00') => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.toISOString().split('T')[0]}T${timeStr}Z`;
};

const getNowString = () => new Date().toISOString();

// SECTORS
const INITIAL_SECTORS: Sector[] = [
  { id: 'sec-1', name: 'Recepção', active: true, created_at: getPastDateString(30), updated_at: getPastDateString(30) },
  { id: 'sec-2', name: 'Governança', active: true, created_at: getPastDateString(30), updated_at: getPastDateString(30) },
  { id: 'sec-3', name: 'Restaurante', active: true, created_at: getPastDateString(30), updated_at: getPastDateString(30) },
  { id: 'sec-4', name: 'Reservas', active: true, created_at: getPastDateString(30), updated_at: getPastDateString(30) }
];

// PROFILES (Users)
const INITIAL_PROFILES: Profile[] = [
  {
    id: 'user-admin',
    full_name: 'Super Admin',
    username: 'admin',
    role: 'admin',
    sector_id: null,
    active: true,
    must_change_password: true,
    avatar_url: null,
    created_at: getPastDateString(45),
    updated_at: getPastDateString(45)
  },
  {
    id: 'user-g1',
    full_name: 'Aline Oliveira',
    username: 'aline.recepcao',
    role: 'guardian',
    sector_id: 'sec-1',
    active: true,
    must_change_password: false,
    avatar_url: null,
    created_at: getPastDateString(15),
    updated_at: getPastDateString(15)
  },
  {
    id: 'user-g2',
    full_name: 'Bruno Silva',
    username: 'bruno.recepcao',
    role: 'guardian',
    sector_id: 'sec-1',
    active: true,
    must_change_password: false,
    avatar_url: null,
    created_at: getPastDateString(15),
    updated_at: getPastDateString(15)
  },
  {
    id: 'user-g3',
    full_name: 'Clara Costa',
    username: 'clara.gov',
    role: 'guardian',
    sector_id: 'sec-2',
    active: true,
    must_change_password: false,
    avatar_url: null,
    created_at: getPastDateString(12),
    updated_at: getPastDateString(12)
  },
  {
    id: 'user-g4',
    full_name: 'Daniel Santos',
    username: 'daniel.rest',
    role: 'guardian',
    sector_id: 'sec-3',
    active: true,
    must_change_password: false,
    avatar_url: null,
    created_at: getPastDateString(10),
    updated_at: getPastDateString(10)
  }
];

// PLATFORMS
const INITIAL_PLATFORMS: Platform[] = [
  {
    id: 'plat-google',
    code: 'google',
    name: 'Google Avaliações',
    external_url: 'https://search.google.com/local/writereview?placeid=ChIJ8SF6uFdfzSgRy8UjPyl9gQ8',
    whatsapp_message_template: 'Olá, {guest_name}! Agradecemos sua estadia no Hotel Royale. Nos ajudaria muito se pudesse avaliar nosso atendimento no Google pelo link: {link}',
    active: true,
    display_order: 1,
    color: '#4285F4',
    created_at: getPastDateString(60),
    updated_at: getPastDateString(60)
  },
  {
    id: 'plat-tripadvisor',
    code: 'tripadvisor',
    name: 'Tripadvisor',
    external_url: 'https://www.tripadvisor.com.br/UserReview-g303604-d306000-Hotel_Royale.html',
    whatsapp_message_template: 'Sua opinião é de ouro para nós! Gostaria de compartilhar sua avaliação sobre o Hotel Royale no Tripadvisor? Use este link rápido: {link}',
    active: true,
    display_order: 3,
    color: '#34E0A1',
    created_at: getPastDateString(60),
    updated_at: getPastDateString(60)
  },
  {
    id: 'plat-internal',
    code: 'internal',
    name: 'MyHotel',
    external_url: 'https://surveys.myhotel.cl/survey-public/surveys-open/mq9qe8CYSFW6RxsWh38TyA?lang=pt',
    whatsapp_message_template: 'Prezado(a) hóspede, sua opinião sincera nos ajuda a aprimorar nossos serviços. Responda nossa pesquisa de satisfação curta do MyHotel em: {link}',
    active: true,
    display_order: 4,
    color: '#1198db',
    created_at: getPastDateString(60),
    updated_at: getPastDateString(60)
  }
];

// MONTHLY PRIZES
const getFormattedCurrentMonth = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const INITIAL_PRIZES: MonthlyPrize[] = [
  {
    id: 'prize-money',
    reference_month: getFormattedCurrentMonth(),
    sector_id: null,
    title: 'Bonificação em Dinheiro',
    description: 'Prêmio em dinheiro direto na folha de pagamento para o guardião destaque em satisfação e número de avaliações coletadas.',
    image_path: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80',
    active: true,
    created_at: getPastDateString(5),
    updated_at: getPastDateString(5)
  },
  {
    id: 'prize-hotel',
    reference_month: getFormattedCurrentMonth(),
    sector_id: null,
    title: 'Diária em Hotel',
    description: 'Uma diária de cortesia com direito a acompanhante em nosso hotel (ou hotel parceiro da rede), com café da manhã incluso.',
    image_path: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80',
    active: true,
    created_at: getPastDateString(5),
    updated_at: getPastDateString(5)
  },
  {
    id: 'prize-gourmet',
    reference_month: getFormattedCurrentMonth(),
    sector_id: null,
    title: 'Jantar Gourmet em Restaurante',
    description: 'Um jantar especial completo com menu degustação de alta gastronomia para celebrar a grande entrega e performance do colaborador no mês.',
    image_path: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80',
    active: true,
    created_at: getPastDateString(5),
    updated_at: getPastDateString(5)
  },
  {
    id: 'prize-pizzaria',
    reference_month: getFormattedCurrentMonth(),
    sector_id: null,
    title: 'Jantar na Pizzaria',
    description: 'Voucher especial de rodízio ou jantar completo com pizzas artesanais assadas no forno a lenha para o guardião e sua família.',
    image_path: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
    active: true,
    created_at: getPastDateString(5),
    updated_at: getPastDateString(5)
  }
];

// INITIAL COMPLAINTS
const INITIAL_COMPLAINTS: Complaint[] = [
  {
    id: 'comp-1',
    invite_id: 'inv-1',
    guest_name: 'Roberto Carlos',
    room_number: '101',
    description: 'Relatou que o ar condicionado estava fazendo um barulho alto durante a noite.',
    status: 'pending',
    created_at: getPastDateString(2, '10:15:00'),
    updated_at: getPastDateString(2, '10:15:00')
  },
  {
    id: 'comp-2',
    invite_id: 'inv-2',
    guest_name: 'Ana Maria',
    room_number: '204',
    description: 'Notou vazamento de água leve embaixo da pia do banheiro.',
    status: 'in_progress',
    created_at: getPastDateString(3, '14:30:00'),
    updated_at: getPastDateString(1, '09:00:00')
  },
  {
    id: 'comp-3',
    invite_id: 'inv-3',
    guest_name: 'José de Alencar',
    room_number: '305',
    description: 'Solicitou toalhas extras de rosto que não estavam no quarto no momento do check-in.',
    status: 'resolved',
    resolved_by: 'user-g1',
    resolver_name: 'Aline Oliveira',
    resolution_notes: 'As toalhas de rosto foram entregues rapidamente pelo setor de governança. O hóspede agradeceu a agilidade.',
    created_at: getPastDateString(5, '18:45:00'),
    updated_at: getPastDateString(5, '19:10:00')
  }
];

// MOCK REVIEW INVITES (Seeding 18 entries)
const INITIAL_INVITES: ReviewInvite[] = [
  {
    id: 'inv-1',
    token: 'tok-abc111',
    issuer_user_id: 'user-g1', // Aline
    issuer_sector_id: 'sec-1',
    platform_id: 'plat-google',
    method: 'qr',
    guest_phone_masked: null,
    status: 'externally_verified_manual',
    opened_count: 2,
    first_opened_at: getPastDateString(10, '10:15:00'),
    last_opened_at: getPastDateString(10, '10:17:00'),
    created_at: getPastDateString(10, '10:10:00'),
    updated_at: getPastDateString(10, '11:00:00')
  },
  {
    id: 'inv-2',
    token: 'tok-abc222',
    issuer_user_id: 'user-g1', // Aline
    issuer_sector_id: 'sec-1',
    platform_id: 'plat-google',
    method: 'whatsapp',
    guest_phone_masked: '+55 (11) 9****-1234',
    status: 'opened',
    opened_count: 1,
    first_opened_at: getPastDateString(9, '15:20:00'),
    last_opened_at: getPastDateString(9, '15:20:00'),
    created_at: getPastDateString(9, '15:00:00'),
    updated_at: getPastDateString(9, '15:20:00')
  },
  {
    id: 'inv-3',
    token: 'tok-abc333',
    issuer_user_id: 'user-g1', // Aline
    issuer_sector_id: 'sec-1',
    platform_id: 'plat-internal',
    method: 'qr',
    guest_phone_masked: null,
    status: 'internal_completed',
    opened_count: 1,
    first_opened_at: getPastDateString(8, '11:12:00'),
    last_opened_at: getPastDateString(8, '11:12:00'),
    created_at: getPastDateString(8, '11:00:00'),
    updated_at: getPastDateString(8, '11:15:00')
  },
  {
    id: 'inv-4',
    token: 'tok-abc444',
    issuer_user_id: 'user-g1', // Aline
    issuer_sector_id: 'sec-1',
    platform_id: 'plat-booking',
    method: 'whatsapp',
    guest_phone_masked: '+55 (21) 9****-5678',
    status: 'externally_reconciled',
    opened_count: 3,
    first_opened_at: getPastDateString(7, '09:40:00'),
    last_opened_at: getPastDateString(7, '12:10:00'),
    created_at: getPastDateString(7, '09:30:00'),
    updated_at: getPastDateString(7, '16:00:00')
  },
  {
    id: 'inv-5',
    token: 'tok-abc555',
    issuer_user_id: 'user-g2', // Bruno
    issuer_sector_id: 'sec-1',
    platform_id: 'plat-google',
    method: 'qr',
    guest_phone_masked: null,
    status: 'externally_verified_manual',
    opened_count: 1,
    first_opened_at: getPastDateString(6, '18:45:00'),
    last_opened_at: getPastDateString(6, '18:45:00'),
    created_at: getPastDateString(6, '18:40:00'),
    updated_at: getPastDateString(6, '19:15:00')
  },
  {
    id: 'inv-6',
    token: 'tok-abc666',
    issuer_user_id: 'user-g2', // Bruno
    issuer_sector_id: 'sec-1',
    platform_id: 'plat-internal',
    method: 'assisted',
    guest_phone_masked: null,
    status: 'internal_completed',
    opened_count: 1,
    first_opened_at: getPastDateString(5, '11:01:00'),
    last_opened_at: getPastDateString(5, '11:01:00'),
    created_at: getPastDateString(5, '11:00:00'),
    updated_at: getPastDateString(5, '11:05:00')
  },
  {
    id: 'inv-7',
    token: 'tok-abc777',
    issuer_user_id: 'user-g3', // Clara
    issuer_sector_id: 'sec-2',
    platform_id: 'plat-google',
    method: 'qr',
    guest_phone_masked: null,
    status: 'externally_verified_manual',
    opened_count: 1,
    first_opened_at: getPastDateString(4, '14:22:00'),
    last_opened_at: getPastDateString(4, '14:22:00'),
    created_at: getPastDateString(4, '14:15:00'),
    updated_at: getPastDateString(4, '15:30:00')
  },
  {
    id: 'inv-8',
    token: 'tok-abc888',
    issuer_user_id: 'user-g3', // Clara
    issuer_sector_id: 'sec-2',
    platform_id: 'plat-internal',
    method: 'whatsapp',
    guest_phone_masked: '+55 (31) 9****-9922',
    status: 'internal_completed',
    opened_count: 1,
    first_opened_at: getPastDateString(3, '16:11:00'),
    last_opened_at: getPastDateString(3, '16:11:00'),
    created_at: getPastDateString(3, '16:00:00'),
    updated_at: getPastDateString(3, '16:15:00')
  },
  {
    id: 'inv-9',
    token: 'tok-abc999',
    issuer_user_id: 'user-g4', // Daniel
    issuer_sector_id: 'sec-3',
    platform_id: 'plat-google',
    method: 'qr',
    guest_phone_masked: null,
    status: 'opened',
    opened_count: 1,
    first_opened_at: getPastDateString(2, '21:05:00'),
    last_opened_at: getPastDateString(2, '21:05:00'),
    created_at: getPastDateString(2, '21:00:00'),
    updated_at: getPastDateString(2, '21:05:00')
  },
  {
    id: 'inv-10',
    token: 'tok-abc101',
    issuer_user_id: 'user-g4', // Daniel
    issuer_sector_id: 'sec-3',
    platform_id: 'plat-tripadvisor',
    method: 'whatsapp',
    guest_phone_masked: '+55 (19) 9****-0033',
    status: 'externally_verified_manual',
    opened_count: 2,
    first_opened_at: getPastDateString(1, '13:05:00'),
    last_opened_at: getPastDateString(1, '13:30:00'),
    created_at: getPastDateString(1, '12:30:00'),
    updated_at: getPastDateString(1, '15:00:00')
  },
  {
    id: 'inv-11',
    token: 'tok-abc102',
    issuer_user_id: 'user-g1', // Aline
    issuer_sector_id: 'sec-1',
    platform_id: 'plat-google',
    method: 'qr',
    guest_phone_masked: null,
    status: 'opened',
    opened_count: 1,
    first_opened_at: getNowString(),
    last_opened_at: getNowString(),
    created_at: getPastDateString(0, '10:00:00'),
    updated_at: getNowString()
  },
  {
    id: 'inv-12',
    token: 'tok-abc103',
    issuer_user_id: 'user-g2', // Bruno
    issuer_sector_id: 'sec-1',
    platform_id: 'plat-tripadvisor',
    method: 'qr',
    guest_phone_masked: null,
    status: 'emitted',
    opened_count: 0,
    first_opened_at: null,
    last_opened_at: null,
    created_at: getPastDateString(0, '11:30:00'),
    updated_at: getPastDateString(0, '11:30:00')
  },
  {
    id: 'inv-13',
    token: 'tok-abc104',
    issuer_user_id: 'user-g3', // Clara
    issuer_sector_id: 'sec-2',
    platform_id: 'plat-booking',
    method: 'qr',
    guest_phone_masked: null,
    status: 'opened',
    opened_count: 1,
    first_opened_at: getNowString(),
    last_opened_at: getNowString(),
    created_at: getPastDateString(0, '12:00:00'),
    updated_at: getNowString()
  }
];

// INTERNAL REVIEWS
const INITIAL_INTERNAL_REVIEWS: InternalReview[] = [
  {
    id: 'rev-1',
    invite_id: 'inv-3',
    score: 5,
    comment: 'Instalações excelentes. O atendimento na recepção feito pela Aline foi espetacular, muito atenciosa!',
    guest_name: 'Marcos Gouvêa',
    room_number: '204',
    guest_email: 'marcos@gmail.com',
    consent_given: true,
    created_at: getPastDateString(8, '11:15:00')
  },
  {
    id: 'rev-2',
    invite_id: 'inv-6',
    score: 4,
    comment: 'Muito boa estrutura. Café da manhã excelente, ficamos bem satisfeitos.',
    guest_name: 'Sabrina Mendes',
    room_number: '315',
    guest_email: 'sabrina.m@uol.com.br',
    consent_given: true,
    created_at: getPastDateString(5, '11:05:00')
  },
  {
    id: 'rev-3',
    invite_id: 'inv-8',
    score: 5,
    comment: 'Governança impecável! Quarto limpo todos os dias com muito esmero.',
    guest_name: 'Luiz Fernando',
    room_number: '102',
    guest_email: 'luizf@hotmail.com',
    consent_given: true,
    created_at: getPastDateString(3, '16:15:00')
  }
];

// MANUAL CONFIRMATIONS
const INITIAL_CONFIRMATIONS: ExternalReviewConfirmation[] = [
  {
    id: 'conf-1',
    invite_id: 'inv-1',
    platform_id: 'plat-google',
    confirmation_type: 'manual',
    external_review_reference: 'Aprovada no perfil Google do Hotel',
    confirmed_by: 'Super Admin',
    notes: 'Confirmado após verificação direta do comentário no Google Business.',
    created_at: getPastDateString(10, '11:00:00')
  },
  {
    id: 'conf-2',
    invite_id: 'inv-5',
    platform_id: 'plat-google',
    confirmation_type: 'manual',
    external_review_reference: 'Comentário Bruno S. no Google',
    confirmed_by: 'Super Admin',
    notes: 'Hóspede deixou avaliação positiva elogiando o check-in do Bruno.',
    created_at: getPastDateString(6, '19:15:00')
  },
  {
    id: 'conf-3',
    invite_id: 'inv-7',
    platform_id: 'plat-google',
    confirmation_type: 'manual',
    external_review_reference: 'Avaliação Clara no Google',
    confirmed_by: 'Super Admin',
    notes: 'Quarto 312 elogiou governança.',
    created_at: getPastDateString(4, '15:30:00')
  },
  {
    id: 'conf-4',
    invite_id: 'inv-10',
    platform_id: 'plat-tripadvisor',
    confirmation_type: 'manual',
    external_review_reference: 'Tripadvisor ID 98212',
    confirmed_by: 'Super Admin',
    notes: 'Avaliação no Tripadvisor que elogia o atendimento do restaurante.',
    created_at: getPastDateString(1, '15:00:00')
  }
];

// AUDIT LOGS
const INITIAL_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    actor_user_id: 'user-admin',
    actor_name: 'Super Admin',
    action: 'login',
    entity_type: 'auth',
    entity_id: null,
    metadata: { browser: 'Chrome', os: 'Windows' },
    created_at: getPastDateString(15, '08:00:00')
  },
  {
    id: 'log-2',
    actor_user_id: 'user-admin',
    actor_name: 'Super Admin',
    action: 'criação de guardião',
    entity_type: 'profiles',
    entity_id: 'user-g1',
    metadata: { nome: 'Aline Oliveira', login: 'aline.recepcao' },
    created_at: getPastDateString(15, '08:30:00')
  },
  {
    id: 'log-3',
    actor_user_id: 'user-g1',
    actor_name: 'Aline Oliveira',
    action: 'emissão de convite',
    entity_type: 'review_invites',
    entity_id: 'inv-1',
    metadata: { platform: 'google', method: 'qr' },
    created_at: getPastDateString(10, '10:10:00')
  },
  {
    id: 'log-4',
    actor_user_id: null,
    actor_name: 'Hóspede Anônimo',
    action: 'abertura de link',
    entity_type: 'review_invites',
    entity_id: 'inv-1',
    metadata: { token: 'tok-abc111' },
    created_at: getPastDateString(10, '10:15:00')
  },
  {
    id: 'log-5',
    actor_user_id: 'user-admin',
    actor_name: 'Super Admin',
    action: 'confirmação manual de avaliação externa',
    entity_type: 'review_invites',
    entity_id: 'inv-1',
    metadata: { token: 'tok-abc111', platform: 'google' },
    created_at: getPastDateString(10, '11:00:00')
  }
];

// LocalStorage helpers with type safety
const getSaved = <T>(key: string, def: T): T => {
  const v = localStorage.getItem(`hotel_reviews_${key}`);
  if (!v) return def;
  try {
    return JSON.parse(v);
  } catch (err) {
    return def;
  }
};

const saveItem = <T>(key: string, val: T) => {
  localStorage.setItem(`hotel_reviews_${key}`, JSON.stringify(val));
};

export class DemoDb {
  static getSectors(): Sector[] {
    return getSaved('sectors', INITIAL_SECTORS);
  }
  static saveSectors(val: Sector[]) {
    saveItem('sectors', val);
  }

  static getProfiles(): Profile[] {
    return getSaved('profiles', INITIAL_PROFILES);
  }
  static saveProfiles(val: Profile[]) {
    saveItem('profiles', val);
  }

  static getPlatforms(): Platform[] {
    const list = getSaved('platforms', INITIAL_PLATFORMS);
    return list
      .filter((p: any) => p.code !== 'booking')
      .sort((a, b) => a.display_order - b.display_order);
  }
  static savePlatforms(val: Platform[]) {
    saveItem('platforms', val);
  }

  static getPrizes(): MonthlyPrize[] {
    const cached = getSaved('prizes', INITIAL_PRIZES);
    // If the old demo prize exists, force override cache with the new ones
    if (cached.some(p => p.title.includes('Guardião de Ouro') || p.id === 'prize-curr')) {
      saveItem('prizes', INITIAL_PRIZES);
      return INITIAL_PRIZES;
    }
    return cached;
  }
  static savePrizes(val: MonthlyPrize[]) {
    saveItem('prizes', val);
  }

  static getInvites(): ReviewInvite[] {
    return getSaved('invites', INITIAL_INVITES);
  }
  static saveInvites(val: ReviewInvite[]) {
    saveItem('invites', val);
  }

  static getComplaints(): Complaint[] {
    return getSaved('complaints', INITIAL_COMPLAINTS);
  }
  static saveComplaints(val: Complaint[]) {
    saveItem('complaints', val);
  }

  static getInternalReviews(): InternalReview[] {
    return getSaved('internal_reviews', INITIAL_INTERNAL_REVIEWS);
  }
  static saveInternalReviews(val: InternalReview[]) {
    saveItem('internal_reviews', val);
  }

  static getConfirmations(): ExternalReviewConfirmation[] {
    return getSaved('confirmations', INITIAL_CONFIRMATIONS);
  }
  static saveConfirmations(val: ExternalReviewConfirmation[]) {
    saveItem('confirmations', val);
  }

  static getLogs(): AuditLog[] {
    return getSaved('logs', INITIAL_LOGS);
  }
  static saveLogs(val: AuditLog[]) {
    saveItem('logs', val);
  }

  static getAdminPassword(): string {
    return localStorage.getItem('hotel_reviews_admin_password') || '0000';
  }
  static saveAdminPassword(p: string) {
    localStorage.setItem('hotel_reviews_admin_password', p);
  }

  static getRankingWeights(): Record<string, number> {
    const DEFAULT_WEIGHTS = {
      qr_generated: 0,
      whatsapp_generated: 0,
      link_opened: 0,
      internal_review_completed: 1,
      external_review_confirmed: 10,
      external_review_reconciled: 10,
      platform_booking: 5,
      platform_tripadvisor: 3,
      platform_google: 2,
      platform_internal: 1
    };
    return getSaved('ranking_weights', DEFAULT_WEIGHTS);
  }
  static saveRankingWeights(val: Record<string, number>) {
    saveItem('ranking_weights', val);
  }

  // --- BUSINESS LOGIC MUTATIONS (SIMULATING EDGE FUNCTIONS AND TRIGGERS) ---

  static addAuditLog(actorUserId: string | null, actorName: string, action: string, entityType: string, entityId: string | null, metadata: Record<string, any> = {}) {
    const logs = this.getLogs();
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      actor_user_id: actorUserId,
      actor_name: actorName,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
      created_at: getNowString()
    };
    logs.unshift(newLog); // Prepend to show newest first!
    this.saveLogs(logs);
  }

  static loginUser(username: string, passwordField: string): { user: Profile | null; error: string | null } {
    const profiles = this.getProfiles();
    const admins = profiles.filter(p => p.role === 'admin');
    
    // Check if admin login by checking admin profile
    if (username === 'admin') {
      const storedPass = this.getAdminPassword();
      if (passwordField === storedPass) {
        // Toggle last login
        const updateProfiles = profiles.map(p => {
          if (p.id === 'user-admin') {
            return { 
              ...p, 
              last_login_at: getNowString(),
              must_change_password: storedPass === '0000'
            };
          }
          return p;
        });
        this.saveProfiles(updateProfiles);
        
        const activeAdmin = updateProfiles.find(p => p.id === 'user-admin')!;
        this.addAuditLog('user-admin', 'Super Admin', 'login', 'auth', null);
        return { user: activeAdmin, error: null };
      }
      return { user: null, error: 'Senha administrativa incorreta.' };
    }

    // Otherwise, check guardian login
    const target = profiles.find(p => p.username.toLowerCase() === username.toLowerCase() && p.role === 'guardian');
    if (!target) {
      return { user: null, error: 'Usuário não encontrado.' };
    }
    if (!target.active) {
      return { user: null, error: 'Usuário inativo. Contate o administrador.' };
    }

    // In demo mode, we let them login with '1234' or their created passwords (stored in localStorage or defaulted to 1234)
    const savedUserPasswords = getSaved<Record<string, string>>('user_passes', {});
    const correctPassword = savedUserPasswords[target.id] || '1234';

    if (passwordField !== correctPassword) {
      return { user: null, error: 'Senha incorreta.' };
    }

    // Success
    const updated = profiles.map(p => {
      if (p.id === target.id) {
        return { ...p, last_login_at: getNowString() };
      }
      return p;
    });
    this.saveProfiles(updated);

    this.addAuditLog(target.id, target.full_name, 'login', 'auth', null);
    return { user: target, error: null };
  }

  static createGuardian(actor: Profile, data: { full_name: string; username: string; password_initial: string; sector_id: string; active: boolean; must_change_password: boolean; avatar_url?: string | null }): { user: Profile | null; error: string | null } {
    const profiles = this.getProfiles();
    const exists = profiles.some(p => p.username.toLowerCase() === data.username.toLowerCase());
    if (exists) {
      return { user: null, error: 'Nome de usuário já existe no sistema.' };
    }

    const newId = `user-${Date.now()}`;
    const newProfile: Profile = {
      id: newId,
      full_name: data.full_name,
      username: data.username,
      role: 'guardian',
      sector_id: data.sector_id,
      active: data.active,
      must_change_password: data.must_change_password,
      avatar_url: data.avatar_url || null,
      created_at: getNowString(),
      updated_at: getNowString()
    };

    profiles.push(newProfile);
    this.saveProfiles(profiles);

    // Save password
    const passwords = getSaved<Record<string, string>>('user_passes', {});
    passwords[newId] = data.password_initial;
    saveItem('user_passes', passwords);

    this.addAuditLog(actor.id, actor.full_name, 'criação de guardião', 'profiles', newId, { nome: data.full_name, login: data.username });
    return { user: newProfile, error: null };
  }

  static updateGuardian(actor: Profile, targetId: string, data: Partial<Profile & { password_new?: string }>): { user: Profile | null; error: string | null } {
    const profiles = this.getProfiles();
    const index = profiles.findIndex(p => p.id === targetId);
    if (index === -1) return { user: null, error: 'Usuário não encontrado' };

    // Check unique username if updated
    if (data.username) {
      const exists = profiles.some(p => p.id !== targetId && p.username.toLowerCase() === data.username!.toLowerCase());
      if (exists) return { user: null, error: 'Nome de usuário já está em uso.' };
    }

    const old = profiles[index];
    const updated: Profile = {
      ...old,
      ...data,
      updated_at: getNowString()
    };
    // Make sure we don't accidentally leak password into profile object itself
    delete (updated as any).password_new;

    profiles[index] = updated;
    this.saveProfiles(profiles);

    if (data.password_new) {
      const passwords = getSaved<Record<string, string>>('user_passes', {});
      passwords[targetId] = data.password_new;
      saveItem('user_passes', passwords);
    }

    this.addAuditLog(actor.id, actor.full_name, 'edição de guardião', 'profiles', targetId, { nome: updated.full_name, mudanças: Object.keys(data) });
    return { user: updated, error: null };
  }

  // CREATE SECTOR
  static createSector(actor: Profile, name: string): Sector {
    const sectors = this.getSectors();
    const newSector: Sector = {
      id: `sec-${Date.now()}`,
      name,
      active: true,
      created_at: getNowString(),
      updated_at: getNowString()
    };
    sectors.push(newSector);
    this.saveSectors(sectors);
    this.addAuditLog(actor.id, actor.full_name, 'criação de setor', 'sectors', newSector.id, { nome: name });
    return newSector;
  }

  // UPDATE SECTOR
  static updateSector(actor: Profile, id: string, name: string, active: boolean): Sector {
    const sectors = this.getSectors();
    const index = sectors.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Setor não encontrado');
    sectors[index] = {
      ...sectors[index],
      name,
      active,
      updated_at: getNowString()
    };
    this.saveSectors(sectors);
    this.addAuditLog(actor.id, actor.full_name, 'edição de setor', 'sectors', id, { nome: name, ativo: active });
    return sectors[index];
  }

  // DELETE SECTOR
  static deleteSector(actor: Profile, id: string): boolean {
    const sectors = this.getSectors();
    const sectorToDelete = sectors.find(s => s.id === id);
    if (!sectorToDelete) throw new Error('Setor não encontrado');
    const filtered = sectors.filter(s => s.id !== id);
    this.saveSectors(filtered);
    this.addAuditLog(actor.id, actor.full_name, 'exclusão de setor', 'sectors', id, { nome: sectorToDelete.name });
    return true;
  }

  // UPDATE PLATFORM MESSAGE OR URL
  static updatePlatform(actor: Profile, id: string, data: Partial<Platform>): Platform {
    const platforms = this.getPlatforms();
    const index = platforms.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Plataforma não encontrada');
    platforms[index] = {
      ...platforms[index],
      ...data,
      updated_at: getNowString()
    };
    this.savePlatforms(platforms);
    this.addAuditLog(actor.id, actor.full_name, 'configuração de plataforma', 'platforms', id, { name: platforms[index].name });
    return platforms[index];
  }

  // SAVE PRIZE
  static savePrize(actor: Profile, data: { id?: string; title: string; description: string; image_path: string | null; sector_id: string | null; reference_month: string; active?: boolean }) {
    const prizes = this.getPrizes();
    
    let activePrizeIndex = -1;
    if (data.id) {
      activePrizeIndex = prizes.findIndex(p => p.id === data.id);
    } else {
      activePrizeIndex = prizes.findIndex(p => p.reference_month === data.reference_month && p.sector_id === data.sector_id);
    }
    
    const activeVal = data.active !== undefined ? data.active : true;
    
    if (activePrizeIndex !== -1) {
      prizes[activePrizeIndex] = {
        ...prizes[activePrizeIndex],
        ...data,
        id: prizes[activePrizeIndex].id,
        active: activeVal,
        updated_at: getNowString()
      };
    } else {
      // deactivate other same type if needed, but here we just append or set
      const newPrize: MonthlyPrize = {
        id: data.id || `prize-${Date.now()}`,
        reference_month: data.reference_month,
        sector_id: data.sector_id,
        title: data.title,
        description: data.description,
        image_path: data.image_path,
        active: activeVal,
        created_at: getNowString(),
        updated_at: getNowString()
      };
      prizes.push(newPrize);
    }
    this.savePrizes(prizes);
    this.addAuditLog(actor.id, actor.full_name, data.id ? 'edição de prêmio' : 'criação de prêmio', 'monthly_prizes', data.id || null, { titulo: data.title, ativo: activeVal });
  }

  // ISSUING A NEW INVITE
  static createInvite(
    actor: Profile, 
    platformCode: PlatformCode, 
    method: 'qr' | 'whatsapp' | 'assisted', 
    guestPhone?: string,
    guestName?: string,
    roomNumber?: string,
    complaintDescription?: string
  ): ReviewInvite {
    const platforms = this.getPlatforms();
    const targetPlatform = platforms.find(p => p.code === platformCode);
    if (!targetPlatform) throw new Error('Plataforma não encontrada');

    const invites = this.getInvites();
    const token = `tok-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // Mask phone number partially to preserve privacy
    let maskedPhone: string | null = null;
    if (guestPhone) {
      const clean = guestPhone.replace(/\D/g, '');
      if (clean.length >= 8) {
        const country = guestPhone.startsWith('+') ? guestPhone.split(' ')[0] : '+55';
        const ddd = clean.length > 9 ? clean.substr(2, 2) : clean.substr(0, 2);
        const lastFour = clean.substr(clean.length - 4);
        maskedPhone = `${country} (${ddd}) 9****-${lastFour}`;
      } else {
        maskedPhone = guestPhone;
      }
    }

    const newInvite: ReviewInvite = {
      id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      token,
      issuer_user_id: actor.id,
      issuer_sector_id: actor.sector_id,
      platform_id: targetPlatform.id,
      method,
      guest_phone_masked: maskedPhone,
      guest_name: guestName || null,
      room_number: roomNumber || null,
      status: 'emitted',
      opened_count: 0,
      first_opened_at: null,
      last_opened_at: null,
      created_at: getNowString(),
      updated_at: getNowString()
    };

    invites.push(newInvite);
    this.saveInvites(invites);

    // Save optional complaint description
    if (complaintDescription && complaintDescription.trim().length > 0) {
      const complaints = this.getComplaints();
      const newComplaint: Complaint = {
        id: `comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        invite_id: newInvite.id,
        guest_name: guestName || 'Hóspede',
        room_number: roomNumber || 'N/A',
        description: complaintDescription.trim(),
        status: 'pending',
        created_at: getNowString(),
        updated_at: getNowString()
      };
      complaints.push(newComplaint);
      this.saveComplaints(complaints);
    }

    // Logs
    this.addAuditLog(actor.id, actor.full_name, 'emissão de convite', 'review_invites', newInvite.id, { platform: platformCode, method, guest_name: guestName, room_number: roomNumber });
    
    return newInvite;
  }

  // REDIRECT (Opening Link)
  static trackRedirect(token: string): { url: string; invite: ReviewInvite | null; error: string | null } {
    const invites = this.getInvites();
    const invitesIndex = invites.findIndex(i => i.token === token);
    if (invitesIndex === -1) {
      return { url: '', invite: null, error: 'Convite não encontrado' };
    }

    const invite = invites[invitesIndex];
    if (invite.status === 'cancelled') {
      return { url: '', invite, error: 'Este convite foi cancelado.' };
    }

    const platforms = this.getPlatforms();
    const plat = platforms.find(p => p.id === invite.platform_id);
    if (!plat) {
      return { url: '', invite, error: 'Plataforma correspondente inativa ou não cadastrada.' };
    }

    // Update counters and status
    const now = getNowString();
    const updatedInvite: ReviewInvite = {
      ...invite,
      opened_count: invite.opened_count + 1,
      status: invite.status === 'emitted' ? 'opened' : invite.status,
      first_opened_at: invite.first_opened_at || now,
      last_opened_at: now,
      updated_at: now
    };

    invites[invitesIndex] = updatedInvite;
    this.saveInvites(invites);

    // Audit log
    this.addAuditLog(null, 'Hóspede Anônimo', 'abertura de link', 'review_invites', invite.id, { token, platform: plat.code });

    // Determine target URL
    let targetUrl = plat.external_url;
    if (plat.code === "internal" && (!targetUrl || targetUrl.trim() === "" || targetUrl.includes("avaliacao-interna"))) {
      targetUrl = `/avaliacao-interna/${token}`;
    }

    return { url: targetUrl, invite: updatedInvite, error: null };
  }

  // SUBMIT INTERNAL REVIEW
  static submitInternalReview(token: string, data: { score: number; comment: string; guest_name?: string; room_number?: string; guest_email?: string; consent_given: boolean }): { review: InternalReview | null; error: string | null } {
    const invites = this.getInvites();
    const invitesIndex = invites.findIndex(i => i.token === token);
    if (invitesIndex === -1) return { review: null, error: 'Token de convite inválido.' };

    const invite = invites[invitesIndex];
    if (invite.status === 'internal_completed') {
      return { review: null, error: 'Este formulário já foi respondido anteriomente.' };
    }

    // Add internal review
    const innerReviews = this.getInternalReviews();
    const newReview: InternalReview = {
      id: `rev-${Date.now()}`,
      invite_id: invite.id,
      score: data.score,
      comment: data.comment,
      guest_name: data.guest_name,
      room_number: data.room_number,
      guest_email: data.guest_email,
      consent_given: data.consent_given,
      created_at: getNowString()
    };

    innerReviews.push(newReview);
    this.saveInternalReviews(innerReviews);

    // Update invite status
    invite.status = 'internal_completed';
    invite.updated_at = getNowString();
    invites[invitesIndex] = invite;
    this.saveInvites(invites);

    this.addAuditLog(null, data.guest_name || 'Hóspede Anônimo', 'envio de avaliação interna', 'internal_reviews', newReview.id, { score: data.score });

    return { review: newReview, error: null };
  }

  // CONFIRM EXTERNAL REVIEW
  static confirmExternalReview(adminProfile: Profile, inviteId: string, notes: string, reference?: string): { confirmation: ExternalReviewConfirmation | null; error: string | null } {
    const invites = this.getInvites();
    const invitesIndex = invites.findIndex(i => i.id === inviteId);
    if (invitesIndex === -1) return { confirmation: null, error: 'Convite não encontrado.' };

    const invite = invites[invitesIndex];
    const confirmations = this.getConfirmations();

    // Check if check already exists
    const exists = confirmations.some(c => c.invite_id === inviteId);
    if (exists) return { confirmation: null, error: 'Este convite já está conciliado/confirmado!' };

    const newConf: ExternalReviewConfirmation = {
      id: `conf-${Date.now()}`,
      invite_id: inviteId,
      platform_id: invite.platform_id,
      confirmation_type: 'manual',
      external_review_reference: reference || 'Confirmação Manual pelo Painel',
      confirmed_by: adminProfile.full_name,
      notes,
      created_at: getNowString()
    };

    confirmations.push(newConf);
    this.saveConfirmations(confirmations);

    // Update status to verified manual
    invite.status = 'externally_verified_manual';
    invite.updated_at = getNowString();
    invites[invitesIndex] = invite;
    this.saveInvites(invites);

    this.addAuditLog(adminProfile.id, adminProfile.full_name, 'confirmação manual de avaliação externa', 'review_invites', inviteId, { referece: reference });

    return { confirmation: newConf, error: null };
  }

  // CREATE BOOKING DIRECT REVIEW
  static createBookingDirectReview(
    adminProfile: Profile,
    guardianId: string,
    guestName: string,
    roomNumber: string,
    notes: string,
    ratingValue: number
  ): { success: boolean; error: string | null } {
    const profiles = this.getProfiles();
    const targetGuardian = profiles.find(p => p.id === guardianId);
    if (!targetGuardian) return { success: false, error: 'Guardião selecionado não foi encontrado.' };

    const platforms = this.getPlatforms();
    const bookingPlatform = platforms.find(p => p.code === 'booking');
    if (!bookingPlatform) return { success: false, error: 'Plataforma Booking.com não configurada.' };

    const invites = this.getInvites();
    const confirmations = this.getConfirmations();

    const inviteId = `inv-booking-${Date.now()}`;
    const token = `booking-attr-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create high quality review_invite on his behalf
    const newInvite: ReviewInvite = {
      id: inviteId,
      token,
      issuer_user_id: guardianId,
      issuer_sector_id: targetGuardian.sector_id,
      platform_id: bookingPlatform.id,
      method: 'assisted',
      guest_phone_masked: null,
      guest_name: guestName,
      room_number: roomNumber || null,
      status: 'externally_verified_manual',
      opened_count: 1,
      first_opened_at: getNowString(),
      last_opened_at: getNowString(),
      created_at: getNowString(),
      updated_at: getNowString()
    };

    invites.push(newInvite);
    this.saveInvites(invites);

    // Create confirmation
    const newConf: ExternalReviewConfirmation = {
      id: `conf-booking-${Date.now()}`,
      invite_id: inviteId,
      platform_id: bookingPlatform.id,
      confirmation_type: 'manual',
      external_review_reference: `Booking.com - Nota ${ratingValue}/10`,
      confirmed_by: adminProfile.full_name,
      notes: notes || 'Atribuição direta de avaliação Booking.com.',
      created_at: getNowString()
    };

    confirmations.push(newConf);
    this.saveConfirmations(confirmations);

    this.addAuditLog(
      adminProfile.id,
      adminProfile.full_name,
      'atribuição direta avaliacao booking',
      'review_invites',
      inviteId,
      { guardianId, guestName, ratingValue }
    );

    return { success: true, error: null };
  }

  // REMOVE EXTERNAL CONFIRMATION
  static removeExternalConfirmation(adminProfile: Profile, inviteId: string): { success: boolean; error: string | null } {
    const invites = this.getInvites();
    const invitesIndex = invites.findIndex(i => i.id === inviteId);
    if (invitesIndex === -1) return { success: false, error: 'Convite não encontrado.' };

    const invite = invites[invitesIndex];
    let confirmations = this.getConfirmations();

    const exists = confirmations.some(c => c.invite_id === inviteId);
    if (!exists) return { success: false, error: 'Este convite não possui confirmação manual registrada.' };

    confirmations = confirmations.filter(c => c.invite_id !== inviteId);
    this.saveConfirmations(confirmations);

    // Fallback status to opened
    invite.status = 'opened';
    invite.updated_at = getNowString();
    invites[invitesIndex] = invite;
    this.saveInvites(invites);

    this.addAuditLog(adminProfile.id, adminProfile.full_name, 'remoção de confirmação', 'review_invites', inviteId);

    return { success: true, error: null };
  }

  // INVALIDATE INVITE
  static invalidateInvite(adminProfile: Profile, inviteId: string): { success: boolean; error: string | null } {
    const invites = this.getInvites();
    const invitesIndex = invites.findIndex(i => i.id === inviteId);
    if (invitesIndex === -1) return { success: false, error: 'Convite não encontrado.' };

    const invite = invites[invitesIndex];
    invite.status = 'cancelled';
    invite.updated_at = getNowString();
    invites[invitesIndex] = invite;
    this.saveInvites(invites);

    this.addAuditLog(adminProfile.id, adminProfile.full_name, 'invalidação manual de avaliação', 'review_invites', inviteId);
    return { success: true, error: null };
  }

  // DELETE INVITE PERMANENTLY
  static deleteInvite(adminProfile: Profile, inviteId: string): { success: boolean; error: string | null } {
    const invites = this.getInvites();
    const invitesIndex = invites.findIndex(i => i.id === inviteId);
    if (invitesIndex === -1) return { success: false, error: 'Convite não encontrado.' };

    const filtered = invites.filter(i => i.id !== inviteId);
    this.saveInvites(filtered);

    this.addAuditLog(adminProfile.id, adminProfile.full_name, 'exclusão definitiva de avaliação', 'review_invites', inviteId);
    return { success: true, error: null };
  }

  // REOPEN INVITE
  static reopenInvite(adminProfile: Profile, inviteId: string): { success: boolean; error: string | null } {
    const invites = this.getInvites();
    const invitesIndex = invites.findIndex(i => i.id === inviteId);
    if (invitesIndex === -1) return { success: false, error: 'Convite não encontrado.' };

    const invite = invites[invitesIndex];
    invite.status = 'opened';
    invite.updated_at = getNowString();
    invites[invitesIndex] = invite;
    this.saveInvites(invites);

    this.addAuditLog(adminProfile.id, adminProfile.full_name, 'regresso para aguardando aprovação', 'review_invites', inviteId);
    return { success: true, error: null };
  }

  // EDIT GUEST DATA
  static updateInviteGuest(actor: Profile, inviteId: string, guestName: string, roomNumber: string): { success: boolean; error: string | null; invite: ReviewInvite | null } {
    const invites = this.getInvites();
    const invitesIndex = invites.findIndex(i => i.id === inviteId);
    if (invitesIndex === -1) return { success: false, error: 'Convite não encontrado.', invite: null };

    const invite = invites[invitesIndex];
    invite.guest_name = guestName;
    invite.room_number = roomNumber;
    invite.updated_at = getNowString();
    
    // Also update dynamic logs or complaints linked to this invite if any
    const complaints = this.getComplaints();
    const complaintsIndex = complaints.findIndex(c => c.invite_id === inviteId);
    if (complaintsIndex !== -1) {
      complaints[complaintsIndex].guest_name = guestName;
      complaints[complaintsIndex].room_number = roomNumber;
      complaints[complaintsIndex].updated_at = getNowString();
      this.saveComplaints(complaints);
    }

    invites[invitesIndex] = invite;
    this.saveInvites(invites);

    this.addAuditLog(actor.id, actor.full_name, 'edição de dados do hóspede do convite', 'review_invites', inviteId, { guestName, roomNumber });
    return { success: true, error: null, invite };
  }

  // SAVE WEIGHTS
  static updateWeights(adminProfile: Profile, key: string, val: number) {
    const w = this.getRankingWeights();
    w[key] = val;
    this.saveRankingWeights(w);
    this.addAuditLog(adminProfile.id, adminProfile.full_name, 'alteração de pesos do ranking', 'ranking_weights', null, { [key]: val });
  }

  // --- CORE METRICS CALCULATION AND RANKING ---

  static calculatePoints(status: InviteStatus, weights: Record<string, number>, platformId?: string): number {
    if (!['internal_completed', 'externally_verified_manual', 'externally_reconciled'].includes(status)) {
      return 0;
    }

    const id = platformId ? platformId.toLowerCase() : '';
    if (id.includes('booking')) {
      return weights.platform_booking ?? 5;
    }
    if (id.includes('tripadvisor')) {
      return weights.platform_tripadvisor ?? 3;
    }
    if (id.includes('google')) {
      return weights.platform_google ?? 2;
    }
    if (id.includes('internal') || id.includes('myhotel') || id.includes('my-hotel')) {
      return weights.platform_internal ?? 1;
    }

    if (status === 'internal_completed') {
      return weights.internal_review_completed ?? 1;
    }
    return weights.external_review_confirmed ?? 10;
  }

  static getMonthlyMetrics() {
    const invites = this.getInvites();
    const internalReviews = this.getInternalReviews();
    const weights = this.getRankingWeights();

    const emitted = invites.length;
    const opened = invites.filter(i => ['opened', 'internal_completed', 'externally_verified_manual', 'externally_reconciled'].includes(i.status)).length;
    const internalCompleted = invites.filter(i => i.status === 'internal_completed').length;
    const externalConfirmed = invites.filter(i => ['externally_verified_manual', 'externally_reconciled'].includes(i.status)).length;
    
    const conversionRate = emitted > 0 ? Math.round(((internalCompleted + externalConfirmed) / emitted) * 100) : 0;

    return {
      emitted,
      opened,
      internalCompleted,
      externalConfirmed,
      conversionRate
    };
  }

  static updateComplaintStatus(
    id: string, 
    status: ComplaintStatus, 
    notes?: string,
    actor?: Profile
  ): void {
    const complaints = this.getComplaints();
    const index = complaints.findIndex(c => c.id === id);
    if (index !== -1) {
      complaints[index] = {
        ...complaints[index],
        status,
        resolution_notes: notes || null,
        resolved_by: actor ? actor.id : null,
        resolver_name: actor ? actor.full_name : null,
        updated_at: getNowString()
      };
      this.saveComplaints(complaints);
      
      this.addAuditLog(
        actor ? actor.id : 'sistema',
        actor ? actor.full_name : 'Sistema',
        `resolução de reclamação (${status})`,
        'complaints',
        id,
        { status, notes }
      );
    }
  }
}
