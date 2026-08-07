import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AssistantIntent } from './assistant-intent.service';
import { AssistantRole } from './knowledge/public-faq';

export type NavigationAction = {
  label: string;
  route: string;
};

const routeAllowlist: Record<AssistantRole, NavigationAction[]> = {
  PUBLIC: [
    { label: 'Home', route: '/' },
    { label: 'About BloodSOS', route: '/about' },
    { label: 'How It Works', route: '/how-it-works' },
    { label: 'Blood Eligibility', route: '/blood-eligibility' },
    { label: 'Nearby Centers', route: '/nearby-centers' },
    { label: 'Register as Donor', route: '/donor-register' },
    { label: 'Login', route: '/login' },
    { label: 'Contact Support', route: '/contact' },
    { label: 'Assistant', route: '/assistant' },
  ],
  DONOR: [
    { label: 'Dashboard', route: '/donor/dashboard' },
    { label: 'Profile', route: '/donor/profile' },
    { label: 'Appointments', route: '/donor/appointments' },
    { label: 'Donation History', route: '/donor/history' },
    { label: 'Notifications', route: '/donor/notifications' },
    { label: 'Eligibility', route: '/donor/eligibility' },
    { label: 'Health Form', route: '/donor/health-form' },
    { label: 'Nearby Centers', route: '/donor/nearby-centers' },
    { label: 'Assistant', route: '/donor/assistant' },
  ],
  HOSPITAL_ADMIN: [
    { label: 'Dashboard', route: '/hospital/dashboard' },
    { label: 'Inventory', route: '/hospital/inventory' },
    { label: 'Stock Intelligence', route: '/hospital/stock-intelligence' },
    { label: 'AI Intelligence', route: '/hospital/ai-intelligence' },
    { label: 'Active Requests', route: '/hospital/active-requests' },
    { label: 'Request History', route: '/hospital/request-history' },
    { label: 'Appointments', route: '/hospital/appointments' },
    { label: 'Clinical Reviews', route: '/hospital/donor-reviews' },
    { label: 'Donor Search', route: '/hospital/donor-search' },
    { label: 'Notifications', route: '/hospital/notifications' },
    { label: 'Reports', route: '/hospital/reports' },
    { label: 'Live Map', route: '/hospital/live-map' },
    { label: 'Assistant', route: '/hospital/assistant' },
  ],
  ADMIN: [
    { label: 'Dashboard', route: '/admin/dashboard' },
    { label: 'AI Intelligence', route: '/admin/management?section=ai-intelligence' },
    { label: 'Donor Communications', route: '/admin/management?section=donor-communications' },
    { label: 'Hospitals', route: '/admin/management?section=hospitals' },
    { label: 'Requests', route: '/admin/management?section=request-tracking' },
    { label: 'Reports', route: '/admin/dashboard' },
    { label: 'Audit Logs', route: '/admin/management?section=audit' },
    { label: 'Assistant', route: '/admin/management?section=assistant' },
  ],
};

const intentRouteLabel: Partial<Record<AssistantIntent, string>> = {
  OPEN_DASHBOARD: 'Dashboard',
  OPEN_INVENTORY: 'Inventory',
  OPEN_STOCK_INTELLIGENCE: 'Stock Intelligence',
  OPEN_AI_INTELLIGENCE: 'AI Intelligence',
  OPEN_APPOINTMENTS: 'Appointments',
  OPEN_CLINICAL_REVIEWS: 'Clinical Reviews',
  OPEN_DONOR_COMMUNICATIONS: 'Donor Communications',
  OPEN_NOTIFICATIONS: 'Notifications',
  OPEN_REPORTS: 'Reports',
  OPEN_PROFILE: 'Profile',
  OPEN_LIVE_MAP: 'Live Map',
};

@Injectable()
export class AssistantNavigationService {
  roleKey(role?: Role): AssistantRole {
    if (role === Role.ADMIN) return 'ADMIN';
    if (role === Role.DONOR) return 'DONOR';
    if (role === Role.HOSPITAL_ADMIN) return 'HOSPITAL_ADMIN';
    return 'PUBLIC';
  }

  getAllowlist(role?: Role) {
    return routeAllowlist[this.roleKey(role)];
  }

  getQuickActions(role?: Role) {
    return this.getAllowlist(role).slice(0, 6);
  }

  actionForIntent(intent: AssistantIntent, role?: Role): NavigationAction | null {
    if (intent === 'CONTACT_SUPPORT') {
      const support = this.roleKey(role) === 'PUBLIC' ? '/contact' : this.roleKey(role) === 'DONOR' ? '/donor/support' : '/hospital/support';
      return this.getAllowlist(role).find((action) => action.route === support) ?? { label: 'Contact Support', route: support };
    }
    if (intent === 'OPEN_REQUESTS') {
      const label = this.roleKey(role) === 'HOSPITAL_ADMIN' ? 'Active Requests' : 'Requests';
      return this.getAllowlist(role).find((action) => action.label === label) ?? null;
    }
    const label = intentRouteLabel[intent];
    if (!label) return null;
    return this.getAllowlist(role).find((action) => action.label === label) ?? null;
  }

  isAllowed(route: string, role?: Role) {
    return this.getAllowlist(role).some((action) => action.route === route);
  }
}
