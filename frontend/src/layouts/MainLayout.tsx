import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function MainLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-white text-text">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold text-primary">
            Blood Response Platform
          </Link>
          <nav className="flex flex-wrap gap-3 text-sm">
            {[
              ['/', 'Home'],
              ['/about', 'About'],
              ['/donor-login', 'Donor Login'],
              ['/hospital-login', 'Hospital Login'],
              ['/admin-login', 'Admin Login'],
            ].map(([path, label]) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `${isActive ? 'text-primary' : 'text-text'} rounded px-2 py-1 hover:bg-red-50`
                }
              >
                {label}
              </NavLink>
            ))}
            {user ? (
              <button className="btn-primary" onClick={logout}>
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
