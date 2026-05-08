export type PublicEmergencyAlert = {
  id: string;
  bloodType: string;
  hospital: string;
  location: string;
  urgency: 'Critical' | 'High' | 'Standard';
  note: string;
};

export const publicEmergencyAlerts: PublicEmergencyAlert[] = [
  {
    id: 'alert-1',
    bloodType: 'O-',
    hospital: 'Tema General Hospital',
    location: 'Tema, Greater Accra',
    urgency: 'Critical',
    note: 'Immediate trauma support needed within the next 2 hours.',
  },
  {
    id: 'alert-2',
    bloodType: 'A+',
    hospital: 'Korle Bu Teaching Hospital',
    location: 'Accra',
    urgency: 'High',
    note: 'Surgical case awaiting compatible units today.',
  },
  {
    id: 'alert-3',
    bloodType: 'B+',
    hospital: 'Cape Coast Teaching Hospital',
    location: 'Cape Coast',
    urgency: 'Standard',
    note: 'Stock refill requested for upcoming scheduled procedures.',
  },
];

export const publicStats = [
  { label: 'Registered Donors', value: '12540', suffix: '+', detail: 'Verified donor workflows connected to hospital response needs.' },
  { label: 'Emergency Matches', value: '3210', suffix: '+', detail: 'Urgent requests coordinated faster through structured matching.' },
  { label: 'Partner Hospitals', value: '25', suffix: '', detail: 'Hospitals and blood centers participating in the response network.' },
  { label: 'Requests Completed', value: '8420', suffix: '+', detail: 'Tracked blood request workflows from creation to fulfillment.' },
];

export const publicVisuals = {
  heroPrimary:
    'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1200&q=80',
  heroSecondary:
    'https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=1200&q=80',
  about:
    'https://images.unsplash.com/photo-1579154341098-e4e158cc7f55?auto=format&fit=crop&w=1200&q=80',
};

export const howItWorksSteps = [
  {
    title: 'Register',
    icon: '01',
    description: 'Create a donor account with your blood group, contact details, and location.',
  },
  {
    title: 'Complete Eligibility',
    icon: '02',
    description: 'Submit your health and eligibility information so hospitals can review it safely.',
  },
  {
    title: 'Get Matched',
    icon: '03',
    description: 'Receive alerts when your blood type and location match an urgent hospital need.',
  },
  {
    title: 'Donate Blood',
    icon: '04',
    description: 'Confirm an appointment or respond to an emergency request from a hospital.',
  },
  {
    title: 'Save Lives',
    icon: '05',
    description: 'Your donation becomes part of a tracked, accountable lifesaving workflow.',
  },
];

export const eligibilityRules = {
  age: ['Usually 18 to 60 years old', 'Some centers may require extra screening for older donors'],
  weight: ['At least 50 kg is commonly required'],
  restrictions: [
    'Do not donate if you have a fever or active infection',
    'Recent surgery, pregnancy, or certain medications may delay donation',
    'Chronic conditions may need review by hospital staff',
  ],
  interval: ['Whole blood donors should wait about 3 months between donations'],
};

export const compatibilityRows = [
  { group: 'O-', givesTo: 'All blood groups', receivesFrom: 'O- only' },
  { group: 'O+', givesTo: 'O+, A+, B+, AB+', receivesFrom: 'O+, O-' },
  { group: 'A-', givesTo: 'A-, A+, AB-, AB+', receivesFrom: 'A-, O-' },
  { group: 'A+', givesTo: 'A+, AB+', receivesFrom: 'A+, A-, O+, O-' },
  { group: 'B-', givesTo: 'B-, B+, AB-, AB+', receivesFrom: 'B-, O-' },
  { group: 'B+', givesTo: 'B+, AB+', receivesFrom: 'B+, B-, O+, O-' },
  { group: 'AB-', givesTo: 'AB-, AB+', receivesFrom: 'AB-, A-, B-, O-' },
  { group: 'AB+', givesTo: 'AB+ only', receivesFrom: 'All blood groups' },
];

export const nearbyCenters = [
  {
    name: 'Korle Bu Teaching Hospital Blood Bank',
    city: 'Accra',
    area: 'Korle Bu',
    note: 'Major referral center with emergency transfusion support.',
  },
  {
    name: 'Tema General Hospital',
    city: 'Tema',
    area: 'Community 1',
    note: 'Partner emergency request center serving Greater Accra east corridor.',
  },
  {
    name: 'Cape Coast Teaching Hospital',
    city: 'Cape Coast',
    area: 'Central Region',
    note: 'Regional referral center for donor appointments and emergency requests.',
  },
];

export const testimonials = [
  {
    name: 'Ama Owusu, Volunteer Donor',
    quote: 'The platform makes it clear when my blood type is needed and where I can help quickly.',
  },
  {
    name: 'Emergency Unit, Partner Hospital',
    quote: 'Tracking requests and donor responses in one place reduces confusion during urgent cases.',
  },
  {
    name: 'Family Caregiver, Accra',
    quote: 'Having a structured hospital request flow is far better than relying only on phone calls.',
  },
];

export const whyDonateItems = [
  {
    title: 'One donation can help multiple lives',
    body: 'Blood donations support trauma care, childbirth emergencies, surgeries, and ongoing medical treatment.',
  },
  {
    title: 'Blood cannot be manufactured',
    body: 'Hospitals depend on human donors, especially during shortages and major emergency events.',
  },
  {
    title: 'Repeat donors strengthen hospital readiness',
    body: 'Regular donations help hospitals maintain safer inventory and reduce last-minute panic calls.',
  },
];

export const trustIndicators = [
  'Hospital verified workflows',
  'Secure donor data handling',
  'Medical review and eligibility checks',
  'Tracked requests, appointments, and donation history',
];

export const notificationPreviewItems = [
  'You have been matched for an urgent O+ request near Tema.',
  'Hospital inventory alert: B- stock is running low at a partner center.',
  'Appointment reminder: Your donor screening slot is scheduled for tomorrow.',
];

export const faqItems = [
  {
    question: 'Who can donate blood?',
    answer: 'Healthy adults who meet age, weight, and screening requirements set by the hospital or blood center.',
  },
  {
    question: 'How often can I donate?',
    answer: 'Whole blood donors typically wait about 3 months between donations, depending on medical review.',
  },
  {
    question: 'Is blood donation safe?',
    answer: 'Yes. Approved blood centers use sterile, single-use equipment and screen donors before collection.',
  },
  {
    question: 'How do emergency requests work?',
    answer: 'Hospitals create urgent requests, matching donors are identified, and alerts are sent for fast response.',
  },
];

export const awarenessItems = [
  {
    title: 'Community Donation Drive Planning',
    body: 'Organize local drives with partner hospitals to build regular voluntary donation habits.',
  },
  {
    title: 'Blood Shortage Awareness',
    body: 'Emergency shortages often affect maternal care, surgeries, trauma response, and sickle cell treatment.',
  },
  {
    title: 'Why Repeat Donors Matter',
    body: 'Consistent donors help hospitals plan safer inventory levels and reduce last-minute panic calls.',
  },
];
