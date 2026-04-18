const faqs = [
  {
    q: 'How do I become eligible again after donation?',
    a: 'Most donors become eligible again after 56 days, subject to health checks.',
  },
  {
    q: 'How do emergency alerts work?',
    a: 'When your blood type and location match an urgent request, you get an in-app notification.',
  },
  {
    q: 'Can I pause notifications?',
    a: 'Yes, open Settings and update your notification preferences anytime.',
  },
];

export default function SupportHelpPage() {
  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Support / Help</h1>
      <p className="text-sm text-gray-600">FAQs and support contact options.</p>
      <div className="space-y-2">
        {faqs.map((item) => (
          <article key={item.q} className="rounded border border-gray-200 p-3">
            <h2 className="font-semibold text-primary">{item.q}</h2>
            <p className="mt-1 text-sm text-gray-700">{item.a}</p>
          </article>
        ))}
      </div>
      <div className="rounded border border-red-200 bg-red-50 p-3 text-sm">
        Contact support: <span className="font-semibold">+233 544515775</span> | +233 554287342
      </div>
    </section>
  );
}
