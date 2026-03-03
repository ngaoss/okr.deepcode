
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    const savedEmail = localStorage.getItem('okr_saved_email');
    const savedPassword = localStorage.getItem('okr_saved_password');
    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await login(email, password);
    if (success) {
      if (rememberMe) {
        localStorage.setItem('okr_saved_email', email);
        localStorage.setItem('okr_saved_password', password);
      } else {
        localStorage.removeItem('okr_saved_email');
        localStorage.removeItem('okr_saved_password');
      }
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } else {
      setError('Thông tin đăng nhập không chính xác hoặc mật khẩu sai.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">
        <div className="p-8 pb-4">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-lg shadow-indigo-100">
            <span className="text-white font-bold text-4xl">O</span>
          </div>
          <h1 className="text-2xl font-black text-center text-slate-800 mb-2">OKR Enterprise Pro</h1>
          <p className="text-center text-slate-500 mb-8 font-medium">Đăng nhập hệ thống quản trị</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all peer"
                placeholder=""
                required
              />
              <label className="absolute left-4 -top-2 text-xs text-slate-500 bg-white px-1 transition-all duration-200 pointer-events-none peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-placeholder-shown:bg-transparent">
                Gmail
              </label>
            </div>

            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all peer"
                placeholder=""
                required
              />
              <label className="absolute left-4 -top-2 text-xs text-slate-500 bg-white px-1 transition-all duration-200 pointer-events-none peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-placeholder-shown:bg-transparent">
                Password
              </label>
            </div>

            <div className="flex items-center space-x-2 px-1">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm text-slate-600 font-medium cursor-pointer select-none">
                Lưu thông tin đăng nhập
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-95"
            >
              Đăng nhập ngay
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
