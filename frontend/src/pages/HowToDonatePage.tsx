export default function HowToDonatePage() {
  return (
    <section className="legacy-panel mx-auto max-w-5xl space-y-5">
      <h1 className="text-center text-5xl font-bold text-primary">Steps To Donate</h1>

      <div className="space-y-2 text-gray-700">
        <h2 className="text-2xl font-bold text-primary">Main Steps followed while donating blood</h2>
        <ol className="list-decimal pl-6">
          <li>Registration</li>
          <li>Medical history and mini-physical</li>
          <li>Donation</li>
          <li>Refreshments</li>
        </ol>
      </div>

      <div className="space-y-2 text-gray-700">
        <h2 className="text-2xl font-bold text-primary">Who can give blood?</h2>
        <ul className="list-disc pl-6">
          <li>You are healthy.</li>
          <li>You weigh above 50kg.</li>
          <li>You are between 17 and 66 years old.</li>
          <li>You have no active infectious disease at donation time.</li>
        </ul>
      </div>
    </section>
  );
}
