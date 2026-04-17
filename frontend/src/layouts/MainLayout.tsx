import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function MainLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-white text-text">
      <header className="border-b border-red-300 bg-primary">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="rounded-md bg-white/95 px-3 py-2 text-lg font-bold text-primary shadow-sm">
            Donation Desk
          </Link>

          <nav className="flex flex-wrap items-center gap-2 text-sm">
            {[
              ['/', 'Home'],
              ['/donor-login', 'Donors'],
              ['/hospital-login', 'Hospitals'],
              ['/request', 'Request'],
              ['/how-to-donate', 'How To Donate'],
              ['/about', 'About Us'],
              ['/contact', 'Contact'],
            ].map(([path, label]) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `${isActive ? 'bg-black/30' : 'bg-transparent'} rounded-md px-3 py-2 font-semibold text-white hover:bg-black/20`
                }
              >
                {label}
              </NavLink>
            ))}
            <NavLink
              to="/admin-login"
              className={({ isActive }) =>
                `${isActive ? 'bg-black/30' : 'bg-white/20'} rounded-md px-3 py-2 font-semibold text-white hover:bg-black/20`
              }
            >
              Admin
            </NavLink>
            {user ? (
              <button className="rounded-md bg-white px-3 py-2 font-semibold text-primary" onClick={logout}>
                Logout
              </button>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
