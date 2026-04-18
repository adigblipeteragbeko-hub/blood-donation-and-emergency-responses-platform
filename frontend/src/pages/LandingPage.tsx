import { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

type PrevalenceRow = {
  left: { group: string; percent: number };
  right: { group: string; percent: number };
  description: string;
};

const rows: PrevalenceRow[] = [
  {
    left: { group: 'A+', percent: 19 },
    right: { group: 'A-', percent: 2 },
    description:
      'Group A blood can be given to patients with blood types A and AB, and blood group A patients can receive types A and O blood.',
  },
  {
    left: { group: 'B+', percent: 21 },
    right: { group: 'B-', percent: 2 },
    description:
      'Group B blood can be given to patients with blood types B and AB, and blood group B patients can receive types B and O blood.',
  },
  {
    left: { group: 'AB+', percent: 3 },
    right: { group: 'AB-', percent: 1 },
    description:
      'Group AB blood can be given to patients with blood type AB, and blood group AB patients can receive any blood type.',
  },
  {
    left: { group: 'O+', percent: 48 },
    right: { group: 'O-', percent: 4 },
    description:
      'Group O blood can be given to patients with all blood types, while blood group O patients can only receive type O blood.',
  },
];

function BloodCircle({ group, percent }: { group: string; percent: number }) {
  const ringStyle: CSSProperties = {
    background: `conic-gradient(from -90deg, #ff1313 0 ${percent}%, #ececec ${percent}% 100%)`,
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-52 w-52 rounded-full" style={ringStyle}>
        <div
          className="absolute inset-[24px] grid place-items-center rounded-full"
          style={{ background: 'repeating-linear-gradient(45deg, #f6f6f6, #f6f6f6 6px, #f3f3f3 6px, #f3f3f3 12px)' }}
        >
          <span className="text-7xl font-extrabold text-[#ff1313]">{group}</span>
        </div>
      </div>
      <p className="text-[42px] font-extrabold text-[#ff1313]">{percent}%</p>
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

      <div className="bg-[#f2f2f2] px-4 py-10 md:px-14">
        <header className="space-y-3 text-center">
          <h2 className="text-5xl font-semibold text-primary md:text-7xl">Someone needs your blood type</h2>
          <p className="text-3xl font-medium text-[#8d98b5] md:text-5xl">Blood Type Prevalence In Ghana</p>
        </header>

        <div className="relative mt-10 border-t border-[#e2e2e2]">
          <div className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-[#e2e2e2] bg-[#f2f2f2]" />
        </div>

        {rows.map((row, index) => (
          <article
            key={`${row.left.group}-${row.right.group}`}
            className={`${index === 0 ? 'border-t-0' : ''} border-t border-[#ff1313] py-10`}
          >
            <div className="grid items-center gap-8 md:grid-cols-[1fr_1.45fr_1fr]">
              <BloodCircle group={row.left.group} percent={row.left.percent} />
              <p className="text-[25px] leading-tight text-[#494949] md:text-[52px]">
                {row.description.split(' ').map((word) =>
                  ['Group', 'A', 'B', 'AB', 'O'].includes(word) ? (
                    <strong key={`${row.left.group}-${word}`}>{`${word} `}</strong>
                  ) : (
                    `${word} `
                  ),
                )}
              </p>
              <BloodCircle group={row.right.group} percent={row.right.percent} />
            </div>
          </article>
        ))}

        <p className="border-t border-[#ff1313] pt-8 text-[25px] leading-tight text-[#4a4a4a] md:text-[46px]">
          No matter your blood type, your blood is always needed to save someone&apos;s life.{' '}
          <Link className="font-semibold text-primary underline" to="/donor-register">
            Sign up to be a blood donor
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
