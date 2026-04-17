export default function AboutPage() {
  return (
    <section className="legacy-panel mx-auto max-w-5xl space-y-4">
      <h1 className="text-center text-5xl font-bold text-primary">About Us</h1>
      <p className="text-lg text-gray-700">
        Donation Desk is a safe blood donation management platform connecting donors, hospitals, and emergency
        coordinators.
      </p>
      <h2 className="text-2xl font-bold text-primary">Our Mission</h2>
      <ol className="list-decimal space-y-2 pl-6 text-gray-700">
        <li>Develop a safe and reliable blood donation ecosystem.</li>
        <li>Make blood requests and donor communication faster in emergencies.</li>
        <li>Protect donor and hospital data with secure workflows.</li>
        <li>Support healthcare teams with live visibility into supply and demand.</li>
        <li>Create a modern platform that saves time and lives.</li>
      </ol>
    </section>
  );
}
