export default function HospitalSupportPage() {
  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Support / Help</h1>
        <p className="text-sm text-muted">Get help, contact support, and review quick FAQs.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="card">
          <h2 className="text-lg font-bold text-primary">Contact Support</h2>
          <p className="mt-2 text-sm text-muted">Phone: +233 544515775</p>
          <p className="text-sm text-muted">Phone: +233 554287342</p>
        </article>
        <article className="card">
          <h2 className="text-lg font-bold text-primary">FAQs</h2>
          <p className="mt-2 text-sm text-muted">
            For urgent incidents, use Emergency Requests first, then contact support for escalation.
          </p>
        </article>
      </div>
    </section>
  );
}

