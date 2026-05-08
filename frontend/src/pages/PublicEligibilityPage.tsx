import { Link } from 'react-router-dom';
import { compatibilityRows, eligibilityRules } from '../data/publicContent';

export default function PublicEligibilityPage() {
  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <div className="section-heading-wrap">
        <p className="section-kicker">Blood Eligibility</p>
        <h1 className="section-title">Clear guidance before someone signs up to donate</h1>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <article className="public-card">
          <h2 className="text-xl font-bold text-primary">Age Requirements</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
            {eligibilityRules.age.map((rule) => (
              <li key={rule}>- {rule}</li>
            ))}
          </ul>
        </article>
        <article className="public-card">
          <h2 className="text-xl font-bold text-primary">Weight Requirements</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
            {eligibilityRules.weight.map((rule) => (
              <li key={rule}>- {rule}</li>
            ))}
          </ul>
        </article>
        <article className="public-card">
          <h2 className="text-xl font-bold text-primary">Medical Restrictions</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
            {eligibilityRules.restrictions.map((rule) => (
              <li key={rule}>- {rule}</li>
            ))}
          </ul>
        </article>
        <article className="public-card">
          <h2 className="text-xl font-bold text-primary">Donation Intervals</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
            {eligibilityRules.interval.map((rule) => (
              <li key={rule}>- {rule}</li>
            ))}
          </ul>
        </article>
      </div>

      <article className="public-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-primary">Blood Compatibility Chart</h2>
            <p className="mt-1 text-sm text-slate-600">A simple compatibility guide to reduce confusion for donors and families.</p>
          </div>
          <Link className="btn-primary" to="/donor-register">Become a Donor</Link>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-slate-500">
                <th className="px-3 py-3 font-semibold">Blood Group</th>
                <th className="px-3 py-3 font-semibold">Can Give To</th>
                <th className="px-3 py-3 font-semibold">Can Receive From</th>
              </tr>
            </thead>
            <tbody>
              {compatibilityRows.map((row) => (
                <tr key={row.group} className="border-b border-gray-100 align-top last:border-b-0">
                  <td className="px-3 py-3 font-bold text-primary">{row.group}</td>
                  <td className="px-3 py-3 text-slate-700">{row.givesTo}</td>
                  <td className="px-3 py-3 text-slate-700">{row.receivesFrom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
