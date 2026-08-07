export type AssistantRole = 'PUBLIC' | 'DONOR' | 'HOSPITAL_ADMIN' | 'ADMIN';

export type KnowledgeEntry = {
  id: string;
  category: string;
  allowedRoles: AssistantRole[];
  questionPatterns: string[];
  title: string;
  answer: string;
  safetyNotice?: string;
  relatedRoute?: string;
  updatedAt: string;
};

export const publicFaq: KnowledgeEntry[] = [
  {
    id: 'platform-overview',
    category: 'PLATFORM',
    allowedRoles: ['PUBLIC', 'DONOR', 'HOSPITAL_ADMIN', 'ADMIN'],
    questionPatterns: ['what is bloodsos', 'how does bloodsos work', 'platform overview'],
    title: 'What BloodSOS does',
    answer: 'BloodSOS connects donors, hospitals, emergency requests, blood inventory, appointments, notifications, and operational decision support in one secure platform.',
    relatedRoute: '/about',
    updatedAt: '2026-07-27',
  },
  {
    id: 'registration',
    category: 'ACCOUNT',
    allowedRoles: ['PUBLIC', 'DONOR', 'HOSPITAL_ADMIN', 'ADMIN'],
    questionPatterns: ['how do i register', 'become a donor', 'create account', 'sign up'],
    title: 'Registration',
    answer: 'You can register as a donor from the donor registration page. Hospitals register through the hospital registration flow and must use approved institutional details.',
    relatedRoute: '/donor-register',
    updatedAt: '2026-07-27',
  },
  {
    id: 'donation-safety',
    category: 'DONATION',
    allowedRoles: ['PUBLIC', 'DONOR', 'HOSPITAL_ADMIN', 'ADMIN'],
    questionPatterns: ['is blood donation safe', 'can donating blood harm me', 'donation safety'],
    title: 'Blood donation safety',
    answer: 'Blood donation is generally safe when performed by trained health professionals using sterile equipment. Eligibility and fitness must still be confirmed by authorised hospital staff.',
    safetyNotice: 'This is general information and not a medical diagnosis.',
    relatedRoute: '/blood-eligibility',
    updatedAt: '2026-07-27',
  },
  {
    id: 'eligibility',
    category: 'DONATION',
    allowedRoles: ['PUBLIC', 'DONOR', 'HOSPITAL_ADMIN', 'ADMIN'],
    questionPatterns: ['eligibility', 'health form', 'can i donate', 'pending review'],
    title: 'Eligibility guidance',
    answer: 'Eligibility depends on your health history and the hospital clinical assessment. Complete the health eligibility form and follow the decision of authorised hospital staff.',
    safetyNotice: 'The assistant cannot clinically approve a donor or diagnose health conditions.',
    relatedRoute: '/blood-eligibility',
    updatedAt: '2026-07-27',
  },
  {
    id: 'appointments',
    category: 'APPOINTMENTS',
    allowedRoles: ['PUBLIC', 'DONOR', 'HOSPITAL_ADMIN', 'ADMIN'],
    questionPatterns: ['appointments work', 'appointment', 'schedule donation'],
    title: 'Appointments',
    answer: 'Appointments help hospitals and donors coordinate donation times. Donors can review appointment status, and hospitals can manage appointment progress and completion.',
    relatedRoute: '/login',
    updatedAt: '2026-07-27',
  },
  {
    id: 'emergency-requests',
    category: 'REQUESTS',
    allowedRoles: ['PUBLIC', 'DONOR', 'HOSPITAL_ADMIN', 'ADMIN'],
    questionPatterns: ['emergency request', 'urgent blood', 'request blood'],
    title: 'Emergency requests',
    answer: 'Emergency requests help hospitals coordinate urgent blood needs with compatible donors and nearby hospitals. Availability must always be confirmed by authorised staff.',
    relatedRoute: '/emergency-requests',
    updatedAt: '2026-07-27',
  },
  {
    id: 'blood-groups',
    category: 'DONATION',
    allowedRoles: ['PUBLIC', 'DONOR', 'HOSPITAL_ADMIN', 'ADMIN'],
    questionPatterns: ['blood groups', 'blood types', 'o positive', 'compatibility'],
    title: 'Blood groups',
    answer: 'BloodSOS tracks O+, O-, A+, A-, B+, B-, AB+, and AB-. Compatibility information is decision support only; transfusion decisions require clinical crossmatching.',
    safetyNotice: 'Do not use this assistant as a substitute for clinical compatibility checks.',
    relatedRoute: '/how-it-works',
    updatedAt: '2026-07-27',
  },
  {
    id: 'support',
    category: 'SUPPORT',
    allowedRoles: ['PUBLIC', 'DONOR', 'HOSPITAL_ADMIN', 'ADMIN'],
    questionPatterns: ['contact support', 'help desk', 'reset password', 'forgot password'],
    title: 'Support',
    answer: 'Use the Contact or Support page for account help, password support, or operational questions that require a person to review your case.',
    relatedRoute: '/contact',
    updatedAt: '2026-07-27',
  },
];
