import { howItWorksSteps } from '../data/publicContent';

export default function HowToDonatePage() {
  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <div className="section-heading-wrap">
        <p className="section-kicker">How It Works</p>
        <h1 className="section-title">From signup to lifesaving donation in a few clear steps</h1>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        {howItWorksSteps.map((step) => (
          <article key={step.title} className="public-card">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-lg font-black text-primary">
              {step.icon}
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-900">{step.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
