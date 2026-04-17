export default function ContactPage() {
  return (
    <section className="legacy-panel mx-auto max-w-5xl space-y-4 text-center">
      <h1 className="text-5xl font-bold text-primary">Contact Us</h1>
      <p className="text-lg text-gray-700">This website is under development. Follow us on social platforms.</p>
      <div className="flex justify-center gap-4">
        {['F', 'I', 'X', 'L'].map((item) => (
          <button
            key={item}
            className="h-12 w-12 rounded-full border border-red-300 bg-white text-xl font-bold text-primary"
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-600">Email support: support@donationdesk.org</p>
    </section>
  );
}
