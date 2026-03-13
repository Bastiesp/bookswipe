import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Explore } from './pages/Explore';
import { Matches } from './pages/Matches';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { Button } from './components/ui/button';

type Page = 'explore' | 'matches' | 'profile' | 'login' | 'signup';

export default function App() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('explore');
  const [showAuthPage, setShowAuthPage] = useState<'login' | 'signup'>('login');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 to-indigo-600">
        <p className="text-white text-lg">Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return showAuthPage === 'login' ? (
      <Login onSwitchToSignUp={() => setShowAuthPage('signup')} />
    ) : (
      <SignUp onSwitchToLogin={() => setShowAuthPage('login')} />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-blue-600">BookMe</h1>

            <nav className="flex gap-2">
              <button
                onClick={() => setCurrentPage('explore')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  currentPage === 'explore'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                📚 Explorar
              </button>
              <button
                onClick={() => setCurrentPage('matches')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  currentPage === 'matches'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                ❤️ Coincidencias
              </button>
              <button
                onClick={() => setCurrentPage('profile')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  currentPage === 'profile'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                👤 Perfil
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {currentPage === 'explore' && <Explore />}
        {currentPage === 'matches' && <Matches />}
        {currentPage === 'profile' && <Profile />}
      </main>
    </div>
  );
}
