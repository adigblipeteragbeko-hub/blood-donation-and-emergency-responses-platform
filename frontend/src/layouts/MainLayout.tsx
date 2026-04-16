import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function MainLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-white text-text md:grid md:grid-cols-[250px_1fr]">
      <aside className="border-b border-r border-gray-200 bg-white md:min-h-screen">
        <div className="px-5 py-5">
          <Link to="/" className="text-xl font-bold text-primary">
            Blood Response Platform
          </Link>
        </div>

        <nav className="flex flex-wrap gap-2 px-3 pb-4 md:flex-col md:gap-1">
          {[
            ['/', 'Home'],
            ['/about', 'About'],
            ['/donor-login', 'Donor Login'],
            ['/hospital-login', 'Hospital Login'],
            ['/admin-login', 'Admin Login'],
            ['/admin/management', 'Admin Panel'],
          ].map(([path, label]) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `${isActive ? 'bg-red-50 text-primary' : 'text-text'} rounded-md px-3 py-2 text-sm hover:bg-red-50`
              }
            >
              {label}
            </NavLink>
          ))}

          {user ? (
            <button className="btn-primary mt-1 md:mt-3" onClick={logout}>
              Logout
            </button>
          ) : null}
        </nav>
      </aside>

      <main className="px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}
