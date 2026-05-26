import { AppIcon } from '../components/ui/AppIcon';

const quickHelp = [
  'Use Emergency Requests first for active blood shortages.',
  'Keep donor profile, location sharing, and availability updated.',
  'Check Notifications for urgent request matches and status changes.',
  'Use Settings to manage alert channels and account access issues.',
];

const faqs = [
  {
    q: 'How do I become a donor?',
    a: 'Create a donor account, verify your email, complete your profile, and submit the eligibility form for review.',
  },
  {
    q: 'How are emergency requests handled?',
    a: 'Hospitals submit requests by blood group, urgency, and location. Matching donors are notified and responses are tracked live.',
  },
  {
    q: 'How do I know if I am eligible to donate?',
    a: 'Your eligibility status appears in your donor portal after clinical and hospital review steps are completed.',
  },
  {
    q: 'How are donors notified?',
    a: 'Matched donors receive in-app emergency notifications and live updates through the portal notification workflow.',
  },
  {
    q: 'Can hospitals track blood availability?',
    a: 'Yes. Hospital and admin dashboards include inventory monitoring, request progress, and operations map visibility.',
  },
  {
    q: 'What should I do if I cannot log in?',
    a: 'Confirm your email verification, reset your password if needed, and contact technical support if access still fails.',
  },
  {
    q: 'How does Smart Blood Bank Tracking work?',
    a: 'It combines request priority, location context, inventory visibility, and live operations updates to support coordination.',
  },
];

export default function SupportHelpPage() {
  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 pb-2 pt-1 sm:px-6">
      <header className="card space-y-3 rounded-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-600">Support Center</p>
        <h1 className="text-2xl font-bold text-primary sm:text-3xl">Support / Help</h1>
        <p className="max-w-3xl text-sm text-muted">
          Operational support for donors and hospital teams. Use this page for urgent guidance, technical help, and common workflow answers.
        </p>
      </header>

      <article className="rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-lg bg-red-100 p-2 text-red-700">
            <AppIcon name="alert" className="h-4 w-4" />
          </span>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-primary">Emergency Notice</h2>
            <p className="text-sm text-slate-700">
              For life-threatening situations or urgent blood shortages, use <span className="font-semibold">Emergency Requests</span> first, then contact the emergency support line for escalation.
            </p>
          </div>
        </div>
      </article>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="card rounded-2xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            <AppIcon name="notification" className="h-4 w-4 text-red-600" />
            Contact Support
          </h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p><span className="font-semibold text-primary">Emergency Line:</span> +233 544 515 775</p>
            <p><span className="font-semibold text-primary">Support Line:</span> +233 554 287 342</p>
            <p><span className="font-semibold text-primary">Email:</span> support@bloodresponse.local</p>
          </div>
        </article>

        <article className="card rounded-2xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            <AppIcon name="clock" className="h-4 w-4 text-red-600" />
            Response Time Information
          </h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p><span className="font-semibold text-primary">Emergency coordination:</span> immediate triage workflow</p>
            <p><span className="font-semibold text-primary">Technical support hours:</span> Monday to Sunday, 06:00 - 22:00</p>
            <p><span className="font-semibold text-primary">Non-urgent inquiries:</span> handled in queue order during support hours</p>
          </div>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <article className="card rounded-2xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            <AppIcon name="form" className="h-4 w-4 text-red-600" />
            Quick Help
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {quickHelp.map((item) => (
              <li key={item} className="rounded-xl border border-red-100 bg-red-50 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="card rounded-2xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            <AppIcon name="settings" className="h-4 w-4 text-red-600" />
            Technical Support
          </h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>For account lockout, routing errors, dashboard loading issues, or notification sync concerns, contact technical support with your role and time of issue.</p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              Include: user role, page URL, approximate time, and a short error description for faster triage.
            </p>
          </div>
        </article>
      </div>

      <article className="card rounded-2xl">
        <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
          <AppIcon name="users" className="h-4 w-4 text-red-600" />
          FAQs
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {faqs.map((item) => (
            <article key={item.q} className="rounded-xl border border-slate-200 bg-white p-3">
              <h3 className="text-sm font-semibold text-primary">{item.q}</h3>
              <p className="mt-1 text-sm text-slate-700">{item.a}</p>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}
