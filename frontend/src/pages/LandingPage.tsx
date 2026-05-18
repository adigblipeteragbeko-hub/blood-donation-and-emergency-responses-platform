import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  awarenessItems,
  faqItems,
  howItWorksSteps,
  nearbyCenters,
  notificationPreviewItems,
  publicEmergencyAlerts,
  publicStats,
  publicVisuals,
  testimonials,
  trustIndicators,
  upcomingActivities,
  whyDonateItems,
  yearlyActivities,
} from '../data/publicContent';
import {
  getCachedPublicWebsiteContent,
  getPublicWebsiteContent,
  PublicWebsiteContent,
  WebsiteStatisticItem,
} from '../services/website-management';

function AnimatedStat({ value, suffix = '' }: { value: string; suffix?: string }) {
  const target = Number(value);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const duration = 900;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <>
      {display.toLocaleString()}
      {suffix}
    </>
  );
}

export default function LandingPage() {
  const [websiteContent, setWebsiteContent] = useState<PublicWebsiteContent | null>(() => getCachedPublicWebsiteContent());
  const [activityIndex, setActivityIndex] = useState(0);

  useEffect(() => {
    let active = true;

    const loadWebsiteContent = async () => {
      try {
        const content = await getPublicWebsiteContent();
        if (!active) return;
        setWebsiteContent(content);
      } catch {
        if (!active) return;
        setWebsiteContent(null);
      }
    };

    loadWebsiteContent();
    return () => {
      active = false;
    };
  }, []);

  const featuredAlert = useMemo(() => {
    if (websiteContent?.alert) {
      return {
        id: websiteContent.alert.id,
        bloodType:
          websiteContent.alert.bloodType?.replace('_POS', '+').replace('_NEG', '-').replace('_', ' ') ?? 'O-',
        hospital: websiteContent.alert.hospitalName,
        location: 'Partner hospital network',
        urgency:
          websiteContent.alert.urgencyLevel === 'CRITICAL'
            ? 'Critical'
            : websiteContent.alert.urgencyLevel === 'HIGH'
              ? 'High'
              : 'Standard',
        note: websiteContent.alert.message,
      };
    }

    return publicEmergencyAlerts[0];
  }, [websiteContent]);

  const displayStats = useMemo(() => {
    if (!websiteContent?.statistics?.length) return publicStats;

    const details: Record<WebsiteStatisticItem['key'], string> = {
      REGISTERED_DONORS: 'Verified donor workflows connected to hospital response needs.',
      EMERGENCY_MATCHES: 'Urgent requests coordinated faster through structured matching.',
      PARTNER_HOSPITALS: 'Hospitals and blood centers participating in the response network.',
      REQUESTS_COMPLETED: 'Tracked blood request workflows from creation to fulfillment.',
    };

    return websiteContent.statistics.map((item) => ({
      label: item.label,
      value: String(item.value),
      suffix: item.value >= 1000 ? '+' : '',
      detail: item.description ?? details[item.key],
    }));
  }, [websiteContent]);

  const displayTestimonials = useMemo(
    () =>
      websiteContent?.testimonials?.length
        ? websiteContent.testimonials.map((item) => ({
            name: item.location ? `${item.name}, ${item.location}` : item.name,
            quote: item.message,
          }))
        : testimonials,
    [websiteContent],
  );

  const displayFaqs = useMemo(
    () =>
      websiteContent?.faqs?.length
        ? websiteContent.faqs.map((item) => ({
            question: item.question,
            answer: item.answer,
          }))
        : faqItems,
    [websiteContent],
  );

  const displayAwareness = useMemo(
    () =>
      websiteContent?.awarenessPosts?.length
        ? websiteContent.awarenessPosts.slice(0, 3).map((item) => ({
            title: item.title,
            body: item.content,
          }))
        : awarenessItems,
    [websiteContent],
  );

  const displayCenters = useMemo(
    () =>
      websiteContent?.partnerHospitals?.length
        ? websiteContent.partnerHospitals.slice(0, 3).map((item) => ({
            name: item.hospitalName,
            city: item.location,
            area: item.email,
            note: item.description ?? item.phone,
          }))
        : nearbyCenters,
    [websiteContent],
  );

  const activityItems = useMemo(() => [...yearlyActivities, ...upcomingActivities], []);
  const activeActivity = activityItems[activityIndex % activityItems.length];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActivityIndex((current) => (current + 1) % activityItems.length);
    }, 5600);

    return () => window.clearInterval(timer);
  }, [activityItems.length]);

  return (
    <div className="space-y-14 pb-8">
      <section className="hero-surface grid gap-8 overflow-hidden rounded-[28px] px-6 py-10 md:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-14 lg:py-14">
        <div className="space-y-6">
          <span className="inline-flex rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm">
            Hospital Blood Donation and Emergency Response Platform
          </span>
          <div className="space-y-4">
            <h1 className="text-4xl font-black leading-tight text-slate-900 md:text-5xl lg:text-6xl">
              Donate Blood, Save Lives
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              A trusted coordination platform for donors, hospitals, and emergency blood requests.
            </p>
          </div>

          <div className="alert-banner-public">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-700">Live Emergency Spotlight</p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                Urgent Need: {featuredAlert.bloodType} blood at {featuredAlert.hospital}
              </p>
              <p className="mt-1 text-sm text-slate-600">{featuredAlert.note}</p>
            </div>
            <Link className="btn-primary whitespace-nowrap" to="/emergency-requests">
              View Requests
            </Link>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="btn-primary" to="/donor-register">
              Become a Donor
            </Link>
            <Link className="btn-secondary" to="/hospital-login">
              Request Blood
            </Link>
            <Link className="btn-secondary" to="/login">
              Login
            </Link>
            <Link className="btn-secondary" to="/contact">
              Contact Hospital
            </Link>
          </div>

          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            {trustIndicators.map((item) => (
              <div key={item} className="trust-pill">
                <span className="trust-pill-dot" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <figure className="image-card-public sm:col-span-2">
            <img
              alt="Hospital staff coordinating blood donation support"
              className="h-full w-full object-cover"
              src={publicVisuals.heroPrimary}
            />
          </figure>
          <figure className="image-card-public">
            <img
              alt="Donor giving blood during a supervised hospital donation session"
              className="h-full w-full object-cover"
              src={publicVisuals.heroSecondary}
            />
          </figure>
          <div className="grid gap-4">
            {displayStats.slice(0, 2).map((item) => (
              <article key={item.label} className="stat-card-public">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-3 text-3xl font-black text-primary">
                  <AnimatedStat suffix={item.suffix} value={item.value} />
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {displayStats.map((item) => (
          <article key={item.label} className="stat-card-public">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-3 text-4xl font-black text-primary">
              <AnimatedStat suffix={item.suffix} value={item.value} />
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="space-y-5">
        <div className="section-heading-wrap">
          <p className="section-kicker">Emergency Requests</p>
          <h2 className="section-title">Active needs, safe public details</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {publicEmergencyAlerts.map((alert) => (
            <article key={alert.id} className="public-card border-red-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-700">{alert.urgency} Priority</p>
                  <h3 className="mt-2 text-xl font-bold text-slate-900">{alert.bloodType} needed</h3>
                </div>
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">Active</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">{alert.hospital}</p>
              <p className="mt-1 text-sm text-slate-500">{alert.location}</p>
              <p className="mt-4 text-sm leading-6 text-slate-600">{alert.note}</p>
              <div className="mt-5 flex gap-3">
                <Link className="btn-primary" to="/donor-register">
                  Respond as Donor
                </Link>
                <Link className="btn-ghost" to="/contact">
                  Contact Hospital
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="section-heading-wrap">
          <p className="section-kicker">How It Works</p>
          <h2 className="section-title">From registration to donation</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          {howItWorksSteps.map((step) => (
            <article key={step.title} className="public-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-lg font-black text-primary">
                {step.icon}
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="activity-showcase">
        <div className="activity-showcase-copy">
          <p className="section-kicker">Activities & Outreach</p>
          <h2 className="section-title">Activities and upcoming programs</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
            A rotating board showing what the platform has done this year and what is coming next.
          </p>

          <div className="mt-6 grid gap-3">
            {activityItems.map((item, index) => (
              <button
                key={`${item.status}-${item.title}`}
                className={`activity-tab ${activityIndex === index ? 'activity-tab-active' : ''}`}
                onClick={() => setActivityIndex(index)}
                type="button"
              >
                <span>{item.title}</span>
                <span>{item.period}</span>
              </button>
            ))}
          </div>
        </div>

        <article className="activity-slide-card" aria-live="polite">
          <img src={activeActivity.image} alt={activeActivity.title} className="activity-slide-image" />
          <div className="activity-slide-overlay">
            <div className="flex flex-wrap items-center gap-2">
              <span className="activity-status-pill">{activeActivity.status}</span>
              <span className="activity-period-pill">{activeActivity.period}</span>
            </div>
            <h3 className="mt-4 text-3xl font-black text-white">{activeActivity.title}</h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-red-50">{activeActivity.description}</p>
            <div className="mt-5 flex gap-2">
              {activityItems.map((item, index) => (
                <button
                  key={item.title}
                  aria-label={`Show ${item.title}`}
                  className={`activity-dot ${activityIndex === index ? 'activity-dot-active' : ''}`}
                  onClick={() => setActivityIndex(index)}
                  type="button"
                />
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_0.95fr]">
        <div className="space-y-5">
          <div className="section-heading-wrap">
            <p className="section-kicker">Why Donate?</p>
            <h2 className="section-title">Why donation matters</h2>
          </div>
          <div className="grid gap-4">
            {whyDonateItems.map((item) => (
              <article key={item.title} className="public-card">
                <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </div>

        <article className="public-card bg-red-50/70">
          <p className="section-kicker">Notification Preview</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900">Fast alerts, clear action</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Donors and hospitals receive the right messages at the right moment.
          </p>
          <div className="mt-6 grid gap-3">
            {notificationPreviewItems.map((item) => (
              <div key={item} className="notification-preview-card">
                <span className="notification-preview-badge" aria-hidden="true" />
                <p className="text-sm font-medium leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-red-200 bg-white p-4">
            <p className="text-sm font-bold text-slate-900">Book Donation Appointment</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Appointment scheduling and donation reminders are already part of the donor and hospital workflow.
            </p>
          </div>
        </article>
      </section>

      <section className="blood-prevalence-section">
        <header className="blood-prevalence-header">
          <h2 className="blood-prevalence-title">Someone needs your blood type</h2>
          <p className="blood-prevalence-subtitle">Blood Type Prevalence In Ghana</p>
        </header>

        <div className="blood-top-divider">
          <div className="blood-top-divider-mark" />
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'O+', value: '48%', note: 'Most requested emergency-compatible positive group' },
            { label: 'B+', value: '21%', note: 'Important for routine and emergency replenishment' },
            { label: 'A+', value: '19%', note: 'High demand for surgery and planned care' },
            { label: 'Rare Negative', value: '1-4%', note: 'Small supply but often critical in emergencies' },
          ].map((item) => (
            <article key={item.label} className="public-card bg-white/90">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-3 text-4xl font-black text-primary">{item.value}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.note}</p>
            </article>
          ))}
        </div>

        <p className="blood-bottom-note mt-8">
          No matter your blood type, your blood is always needed to save someone's life.{' '}
          <Link className="blood-bottom-link" to="/donor-register">
            Sign up to be a blood donor &gt;&gt;&gt;
          </Link>
        </p>
      </section>

      <section className="space-y-5">
        <div className="section-heading-wrap">
          <p className="section-kicker">Nearby Centers</p>
          <h2 className="section-title">Nearby donation centers</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {displayCenters.map((center) => (
            <article key={center.name} className="public-card">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-700">{center.city}</p>
              <h3 className="mt-2 text-xl font-bold text-slate-900">{center.name}</h3>
              <p className="mt-2 text-sm font-medium text-slate-700">{center.area}</p>
              <p className="mt-4 text-sm leading-6 text-slate-600">{center.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_0.95fr]">
        <div className="space-y-5">
          <div className="section-heading-wrap">
            <p className="section-kicker">Testimonials</p>
            <h2 className="section-title">Trusted by donors and hospitals</h2>
          </div>
          <div className="grid gap-4">
            {displayTestimonials.map((item) => (
              <article key={item.name} className="public-card">
                <p className="text-base leading-7 text-slate-700">"{item.quote}"</p>
                <p className="mt-4 text-sm font-bold text-primary">{item.name}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="section-heading-wrap">
            <p className="section-kicker">Frequently Asked Questions</p>
            <h2 className="section-title">Quick donor answers</h2>
          </div>
          <div className="grid gap-4">
            {displayFaqs.map((item) => (
              <article key={item.question} className="public-card">
                <h3 className="text-lg font-bold text-slate-900">{item.question}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="section-heading-wrap">
          <p className="section-kicker">News & Awareness</p>
          <h2 className="section-title">Awareness updates</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {displayAwareness.map((item) => (
            <article key={item.title} className="public-card">
              <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cta-band-public">
        <div>
          <p className="section-kicker text-red-200">Ready To Save A Life?</p>
          <h2 className="mt-2 text-3xl font-black text-white md:text-4xl">
            Join a trusted emergency donor network.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-red-50/90">
            Register, check eligibility, and help hospitals respond when every minute matters.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-lg bg-white px-5 py-3 font-bold text-primary transition hover:bg-red-50"
            to="/donor-register"
          >
            Become a Donor
          </Link>
          <Link
            className="rounded-lg border border-white/40 px-5 py-3 font-bold text-white transition hover:bg-white/10"
            to="/blood-eligibility"
          >
            Check Eligibility
          </Link>
        </div>
      </section>
    </div>
  );
}
