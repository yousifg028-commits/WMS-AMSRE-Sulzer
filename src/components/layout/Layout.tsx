import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  onLogout: () => void;
  currentUser: { id: string; username: string; role: string; fullName: string };
}

export default function Layout({ onLogout, currentUser }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-[260px]">
        <Header onLogout={onLogout} currentUser={currentUser} />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
