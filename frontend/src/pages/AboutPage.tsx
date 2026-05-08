import { Link } from 'react-router-dom';
import { publicVisuals, trustIndicators, whyDonateItems } from '../data/publicContent';

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <div className="hero-surface grid gap-8 rounded-[28px] px-6 py-10 md:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="section-kicker">About The Platform</p>
          <h1 className="mt-3 text-4xl font-black text-slate-900 md:text-5xl">
            Built to improve trust, speed, and coordination in blood donation
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            This platform supports hospitals, donors, and administrators with a safer and more structured way to handle
            blood donation, inventory visibility, appointment flow, and emergency request coordination.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {trustIndicators.map((item) => (
              <div key={item} className="trust-pill">
                <span className="trust-pill-dot" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <figure className="image-card-public min-h-[360px]">
          <img
            alt="Medical professionals discussing blood donation support and hospital coordination"
            className="h-full w-full object-cover"
            src={publicVisuals.about}
          />
        </figure>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <article className="public-card">
          <h2 className="text-2xl font-bold text-primary">Why Blood Donation Matters</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Blood is essential for trauma care, childbirth emergencies, surgeries, anemia treatment, sickle cell
            support, and many chronic conditions. Fast donor mobilization can make the difference between delay and survival.
          </p>
        </article>
        <article className="public-card">
          <h2 className="text-2xl font-bold text-primary">Hospital Partnership</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Partner hospitals use the platform to request blood, manage inventory, schedule appointments, review donor
            eligibility, and follow donor response activity in one professional workflow.
          </p>
        </article>
        <article className="public-card">
          <h2 className="text-2xl font-bold text-primary">Our Mission</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            To reduce emergency response delays, increase voluntary blood donation, and give healthcare teams a more
            reliable coordination system.
          </p>
        </article>
        <article className="public-card">
          <h2 className="text-2xl font-bold text-primary">Our Vision</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            To help build a safer, more transparent, and more responsive blood support ecosystem across Ghana.
          </p>
        </article>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {whyDonateItems.map((item) => (
          <article key={item.title} className="public-card">
            <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="cta-inline-public">
        <div>
          <p className="section-kicker">Join The Mission</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900">Every verified donor strengthens emergency readiness.</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="btn-primary" to="/donor-register">
            Become a Donor
          </Link>
          <Link className="btn-secondary" to="/how-it-works">
            See How It Works
          </Link>
        </div>
      </section>
    </section>
  );
}
