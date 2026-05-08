import { useEffect, useMemo, useState } from 'react';
import { getPublicWebsiteContent, WebsiteFooterSettingsItem } from '../services/website-management';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [footerSettings, setFooterSettings] = useState<WebsiteFooterSettingsItem | null>(null);

  useEffect(() => {
    let active = true;

    const loadFooter = async () => {
      try {
        const content = await getPublicWebsiteContent();
        if (!active) return;
        setFooterSettings(content.footerSettings);
      } catch {
        if (!active) return;
        setFooterSettings(null);
      }
    };

    loadFooter();
    return () => {
      active = false;
    };
  }, []);

  const errors = useMemo(() => {
    const next: Partial<Record<keyof typeof form, string>> = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.email.trim()) next.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address';
    if (!form.subject.trim()) next.subject = 'Subject is required';
    if (!form.message.trim()) next.message = 'Message is required';
    return next;
  }, [form]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    setForm({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <div className="section-heading-wrap">
        <p className="section-kicker">Contact</p>
        <h1 className="section-title">Reach hospitals, support lines, and the platform team quickly</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="public-card space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-primary">Hospital and Support Contacts</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use these channels for urgent coordination, general help, and partnership questions.
            </p>
          </div>
          <div className="space-y-4 text-sm text-slate-700">
            <div>
              <p className="font-bold text-slate-900">Emergency Contact</p>
              <p>{footerSettings?.emergencyPhonePrimary ?? '+233 544515775'}</p>
              <p>{footerSettings?.emergencyPhoneSecondary ?? '+233 554287342'}</p>
            </div>
            <div>
              <p className="font-bold text-slate-900">Support Email</p>
              <p>{footerSettings?.supportEmail ?? 'support@bloodresponse.local'}</p>
            </div>
            <div>
              <p className="font-bold text-slate-900">FAQ Topics</p>
              <p>Donor eligibility, emergency requests, hospital onboarding, and appointment support.</p>
            </div>
          </div>
        </article>

        <form className="public-card space-y-4" onSubmit={handleSubmit}>
          <div>
            <h2 className="text-2xl font-bold text-primary">Inquiry Form</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Send a non-emergency message and a hospital or support contact can follow up.
            </p>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Full Name
            <input
              className="legacy-input mt-2"
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
              placeholder="Your full name"
              value={form.name}
            />
            {submitted && errors.name ? <span className="mt-2 block text-xs text-primary">{errors.name}</span> : null}
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Email Address
            <input
              className="legacy-input mt-2"
              onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
              placeholder="you@example.com"
              type="email"
              value={form.email}
            />
            {submitted && errors.email ? <span className="mt-2 block text-xs text-primary">{errors.email}</span> : null}
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Subject
            <input
              className="legacy-input mt-2"
              onChange={(e) => setForm((v) => ({ ...v, subject: e.target.value }))}
              placeholder="What is your message about?"
              value={form.subject}
            />
            {submitted && errors.subject ? (
              <span className="mt-2 block text-xs text-primary">{errors.subject}</span>
            ) : null}
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Message
            <textarea
              className="legacy-input mt-2 min-h-32"
              onChange={(e) => setForm((v) => ({ ...v, message: e.target.value }))}
              placeholder="How can we help?"
              value={form.message}
            />
            {submitted && errors.message ? (
              <span className="mt-2 block text-xs text-primary">{errors.message}</span>
            ) : null}
          </label>
          {submitted && Object.keys(errors).length === 0 ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              Inquiry captured successfully. A support contact can follow up through the details you provided.
            </p>
          ) : null}
          <button className="btn-primary" type="submit">
            Send Inquiry
          </button>
        </form>
      </div>
    </section>
  );
}
