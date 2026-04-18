import { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type PrevalenceRow = {
  left: { group: string; percent: number; ring: number };
  right: { group: string; percent: number; ring: number };
  description: ReactNode;
};

const rows: PrevalenceRow[] = [
  {
    left: { group: 'A+', percent: 19, ring: 19 },
    right: { group: 'A\u2212', percent: 2, ring: 2 },
    description: (
      <>
        <strong>Group A</strong> blood can be given to patients with blood types A and AB, and blood group A
        patients can receive types A and O blood.
        <br />
        However, anybody with any of the blood types can always give blood.
      </>
    ),
  },
  {
    left: { group: 'B+', percent: 21, ring: 21 },
    right: { group: 'B\u2212', percent: 2, ring: 2 },
    description: (
      <>
        <strong>Group B</strong> blood can be given to patients with blood types B and AB, and blood group B
        patients can receive types B and O blood.
        <br />
        However, no matter your blood type, you can always give blood.
      </>
    ),
  },
  {
    left: { group: 'AB+', percent: 3, ring: 3 },
    right: { group: 'AB\u2212', percent: 1, ring: 1 },
    description: (
      <>
        <strong>Group AB</strong> blood can be given to patients with blood type AB but blood group AB patients can
        receive any blood type.
        <br />
        Irrespective of your blood type, you can always give blood.
      </>
    ),
  },
  {
    left: { group: 'O+', percent: 48, ring: 48 },
    right: { group: 'O\u2212', percent: 4, ring: 4 },
    description: (
      <>
        <strong>Group O</strong> blood can be given to patients with all blood types but blood group O patients can
        only receive type O blood.
        <br />
        Meanwhile, anybody with any of the blood types can always give blood.
      </>
    ),
  },
];

function BloodCircle({ group, percent, ring }: { group: string; percent: number; ring: number }) {
  const ringStyle: CSSProperties = {
    background: `conic-gradient(from -90deg, #ff1313 0 ${ring}%, #ececec ${ring}% 100%)`,
  };

  return (
    <div className="blood-group-circle-wrap">
      <div className="blood-group-ring" style={ringStyle}>
        <div className="blood-group-center">
          <span className="blood-group-label">{group}</span>
        </div>
      </div>
      <p className="blood-group-percent">{percent}%</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <section className="space-y-6">
      <div className="legacy-panel grid gap-6 md:grid-cols-2 md:items-center">
        <div className="space-y-4">
          <h1 className="legacy-title">DONATE BLOOD!!!</h1>
          <p className="text-lg text-gray-700">
            If you are a blood donor, you are a hero to someone waiting for a second chance at life.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link className="btn-primary" to="/donor-register">
              Donor Registration
            </Link>
            <Link className="rounded-lg border border-primary px-4 py-2 font-semibold text-primary" to="/request">
              Send Request
            </Link>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
          <img
            alt="Blood donation"
            className="h-72 w-full object-cover"
            src="https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=1200&q=80"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="legacy-panel">
          <h3 className="mb-2 text-xl font-bold text-primary">Donors</h3>
          <p className="text-gray-700">Register, manage eligibility, and respond to emergency blood alerts.</p>
        </div>
        <div className="legacy-panel">
          <h3 className="mb-2 text-xl font-bold text-primary">Hospitals</h3>
          <p className="text-gray-700">Create blood requests and monitor inventory fulfillment in real time.</p>
        </div>
        <div className="legacy-panel">
          <h3 className="mb-2 text-xl font-bold text-primary">Emergency</h3>
          <p className="text-gray-700">Urgent requests are matched quickly by blood group and location.</p>
        </div>
      </div>

      <div className="blood-prevalence-section">
        <header className="blood-prevalence-header">
          <h2 className="blood-prevalence-title">Someone needs your blood type</h2>
          <p className="blood-prevalence-subtitle">Blood Type Prevalence In Ghana</p>
        </header>

        <div className="blood-top-divider">
          <div className="blood-top-divider-mark" />
        </div>

        {rows.map((row, index) => (
          <article key={`${row.left.group}-${row.right.group}`} className={index === 0 ? 'blood-row' : 'blood-row blood-row-bordered'}>
            <div className="blood-row-grid">
              <BloodCircle group={row.left.group} percent={row.left.percent} ring={row.left.ring} />
              <p className="blood-row-description">
                {row.description}
              </p>
              <BloodCircle group={row.right.group} percent={row.right.percent} ring={row.right.ring} />
            </div>
          </article>
        ))}

        <p className="blood-bottom-note">
          No matter your blood type, your blood is always needed to save someone&apos;s life.{' '}
          <Link className="blood-bottom-link" to="/donor-register">
            Sign up to be a blood donor &gt;&gt;&gt;
          </Link>
        </p>
      </div>
    </section>
  );
}
