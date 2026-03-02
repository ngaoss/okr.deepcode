import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NavLink: React.FC<{ to: string, children: React.ReactNode, icon: string, title?: string }> = ({ to, children, icon, title }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      title={title || (typeof children === 'string' ? children : '')}
      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 translate-x-1'
        : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-600'
        }`}
    >
      <span className="material-icons text-xl shrink-0">{icon}</span>
      <span className="font-semibold text-sm truncate">{children}</span>
    </Link>
  );
};

const NavGroup: React.FC<{ title: string, icon: string, children: React.ReactNode, defaultOpen?: boolean, isCollapsed?: boolean }> = ({ title, icon, children, defaultOpen = false, isCollapsed = false }) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  return (
    <div className="space-y-1 mb-2">
      <button
        onClick={() => !isCollapsed && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl transition-all group ${isCollapsed ? 'justify-center' : ''}`}
      >
        <div className="flex items-center space-x-3">
          <div className={`p-1.5 rounded-lg transition-colors ${isOpen && !isCollapsed ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
            <span className="material-icons text-lg">{icon}</span>
          </div>
          {!isCollapsed && (
            <span className={`font-bold text-xs uppercase tracking-wider transition-colors ${isOpen ? 'text-indigo-600' : 'text-slate-500 group-hover:text-indigo-600'}`}>
              {title}
            </span>
          )}
        </div>
        {!isCollapsed && (
          <span className={`material-icons text-lg text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        )}
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen && !isCollapsed ? 'max-h-[800px] opacity-100 mb-4' : 'max-h-0 opacity-0'}`}>
        <div className="pl-4 space-y-1 mt-1 border-l-2 border-slate-100 ml-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, selectedPeriod, setSelectedPeriod, updateAvatar } = useAuth();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [showAvatarModal, setShowAvatarModal] = React.useState(false);
  const [avatarInput, setAvatarInput] = React.useState('');
  const [isSavingAvatar, setIsSavingAvatar] = React.useState(false);

  React.useEffect(() => {
    setAvatarInput(user?.avatar || '');
  }, [user]);

  const handleGenerateAvatar = () => {
    const seed = user?.name || user?.email || 'user';
    setAvatarInput(`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`);
  };

  const handleSaveAvatar = async () => {
    if (!user) return;
    setIsSavingAvatar(true);
    try {
      const uid = (user as any).id || (user as any)._id;
      await updateAvatar(uid, avatarInput);
      setShowAvatarModal(false);
    } catch (err) {
      alert((err as any)?.message || 'Không thể cập nhật avatar');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const years = [2023, 2024, 2025, 2026];
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-['Inter']">
      {/* Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-24' : 'w-72'} bg-white border-r border-slate-200 flex flex-col hidden md:flex shrink-0 transition-all duration-300 relative group`}>
        {/* Toggle Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-24 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-md z-20 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all"
        >
          <span className="material-icons text-sm">{isSidebarCollapsed ? 'chevron_right' : 'chevron_left'}</span>
        </button>

        <div className={`p-8 ${isSidebarCollapsed ? 'px-4' : ''}`}>
          <div className="flex items-center space-x-3">
            <div className={`w-11 h-11 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200 shrink-0`}>
              <span className="text-white font-black text-2xl">O</span>
            </div>
            {!isSidebarCollapsed && (
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-800 leading-none">OKR Pro</h1>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Enterprise</span>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar pb-10">
          <div className="mb-4 space-y-1">
            <NavLink to="/" icon="dashboard" title="Bảng điều khiển">{isSidebarCollapsed ? '' : 'Bảng điều khiển'}</NavLink>
            <NavLink to="/gantt" icon="timeline" title="Biểu đồ Gantt">{isSidebarCollapsed ? '' : 'Biểu đồ Gantt'}</NavLink>
          </div>

          <NavGroup title={isSidebarCollapsed ? '' : 'Quản lý Công việc'} icon="business_center" defaultOpen={true} isCollapsed={isSidebarCollapsed}>
            <NavLink to="/attendance" icon="fingerprint">{isSidebarCollapsed ? '' : 'Điểm danh'}</NavLink>
            <NavLink to="/schedules" icon="event_note">{isSidebarCollapsed ? '' : 'Lịch làm việc'}</NavLink>
            <NavLink to="/project-dashboard" icon="analytics">{isSidebarCollapsed ? '' : 'Dashboard Dự án'}</NavLink>
            <NavLink to="/backlog" icon="inventory_2">{isSidebarCollapsed ? '' : 'Backlog (Yêu cầu)'}</NavLink>
            <NavLink to="/sprints" icon="bolt">{isSidebarCollapsed ? '' : 'Sprints (Chu kỳ)'}</NavLink>
            <NavLink to="/board" icon="view_kanban">{isSidebarCollapsed ? '' : 'Board Kanban'}</NavLink>
            <NavLink to="/meetings" icon="description">{isSidebarCollapsed ? '' : 'Meeting Sheets'}</NavLink>
            {user?.role !== 'NHÂN VIÊN' && (
              <>
                <NavLink to="/table" icon="table_chart">{isSidebarCollapsed ? '' : 'Bảng chi tiết'}</NavLink>
                <NavLink to="/project-notes" icon="note_alt">{isSidebarCollapsed ? '' : 'Ghi chú & Note'}</NavLink>
              </>
            )}
          </NavGroup>

          <NavGroup title={isSidebarCollapsed ? '' : 'Mục tiêu OKR'} icon="track_changes" isCollapsed={isSidebarCollapsed}>
            <NavLink to="/tasks" icon="assignment">{isSidebarCollapsed ? '' : 'Việc cần làm'}</NavLink>
            <NavLink to="/okrs" icon="flag">{isSidebarCollapsed ? '' : 'Tất cả OKR'}</NavLink>
            <NavLink to="/myOkrs" icon="person">{isSidebarCollapsed ? '' : 'OKR của tôi'}</NavLink>
            <NavLink to="/automation" icon="smart_toy">{isSidebarCollapsed ? '' : 'Tự động hóa'}</NavLink>
          </NavGroup>

          <NavGroup title={isSidebarCollapsed ? '' : 'Tổ chức'} icon="account_tree" isCollapsed={isSidebarCollapsed}>
            {user?.role !== 'NHÂN VIÊN' && <NavLink to="/users" icon="group">{isSidebarCollapsed ? '' : 'Thành viên'}</NavLink>}
            <NavLink to="/teams" icon="corporate_fare">{isSidebarCollapsed ? '' : 'Phòng ban'}</NavLink>
            <NavLink to="/workgroups" icon="groups">{isSidebarCollapsed ? '' : 'Nhóm làm việc'}</NavLink>
            <NavLink to="/kpis/department" icon="bar_chart">{isSidebarCollapsed ? '' : 'KPI Phòng ban'}</NavLink>
            <NavLink to="/kpis/personal" icon="person_pin">{isSidebarCollapsed ? '' : 'KPI Cá nhân'}</NavLink>
            <NavLink to="/reports" icon="insights">{isSidebarCollapsed ? '' : 'Báo cáo tổng hợp'}</NavLink>
          </NavGroup>
        </nav>

        <div className={`p-4 border-t border-slate-100 bg-slate-50/50 ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'} mb-4`}>
            <button onClick={() => setShowAvatarModal(true)} className="relative group shrink-0">
              <img src={user?.avatar} alt="avatar" className="w-11 h-11 rounded-2xl border-2 border-white bg-white shadow-sm object-cover" />
              <div className="absolute inset-0 bg-black/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="material-icons text-white text-xs">edit</span>
              </div>
            </button>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-black text-slate-800 truncate">{user?.name}</p>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter truncate">{user?.role} • {user?.department}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`flex items-center justify-center space-x-2 text-xs font-black uppercase tracking-widest text-red-500 bg-white border border-red-100 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm ${isSidebarCollapsed ? 'w-11 h-11 p-0' : 'w-full px-4 py-2.5'}`}
          >
            <span className="material-icons text-sm">logout</span>
            {!isSidebarCollapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-10 sticky top-0 z-10">
          <div className="flex items-center md:hidden">
            <span className="material-icons text-slate-600">menu</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative group">
              <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg group-focus-within:text-indigo-600 transition-colors">search</span>
              <input
                type="text"
                placeholder="Tìm kiếm nhanh..."
                className="pl-12 pr-6 py-2.5 bg-slate-100 focus:bg-white border-none rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/10 w-64 md:w-96 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <button className="relative p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
              <span className="material-icons">notifications</span>
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>

            <div className="h-8 w-px bg-slate-200"></div>

            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl p-1.5 shadow-sm">
              <select
                value={selectedPeriod.quarter}
                onChange={(e) => setSelectedPeriod({ ...selectedPeriod, quarter: e.target.value })}
                className="bg-transparent text-xs font-black text-slate-600 outline-none px-3 py-1 cursor-pointer hover:text-indigo-600 transition-colors"
              >
                {quarters.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
              <div className="h-4 w-px bg-slate-300"></div>
              <select
                value={selectedPeriod.year}
                onChange={(e) => setSelectedPeriod({ ...selectedPeriod, year: parseInt(e.target.value) })}
                className="bg-transparent text-xs font-black text-slate-600 outline-none px-3 py-1 cursor-pointer hover:text-indigo-600 transition-colors"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-slate-50/30">
          {children}
        </div>
      </main>

      {showAvatarModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 space-y-6 shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Cập nhật Avatar</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">URL Ảnh của bạn</label>
                <div className="flex items-center space-x-3">
                  <input
                    value={avatarInput}
                    onChange={(e) => setAvatarInput(e.target.value)}
                    placeholder="Dán link ảnh tại đây..."
                    className="flex-1 p-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
                  />
                  <button onClick={handleGenerateAvatar} className="px-4 py-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm">
                    <span className="material-icons text-indigo-600">auto_awesome</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-center p-4 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                {avatarInput ? (
                  <img src={avatarInput} className="w-28 h-28 rounded-[1.5rem] shadow-xl object-cover border-4 border-white" alt="preview" />
                ) : (
                  <div className="w-28 h-28 rounded-[1.5rem] bg-indigo-50 flex items-center justify-center">
                    <span className="material-icons text-indigo-200 text-4xl">face</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                onClick={() => setShowAvatarModal(false)}
                className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSaveAvatar}
                disabled={isSavingAvatar}
                className={`flex-1 px-6 py-4 rounded-[1.2rem] text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-200 transition-all ${isSavingAvatar ? 'bg-slate-300 text-slate-500 shadow-none' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0'}`}
              >
                {isSavingAvatar ? 'Đang lưu...' : 'Cập nhật ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
    </div>
  );
};
