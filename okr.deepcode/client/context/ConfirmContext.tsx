import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  isAlert?: boolean;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolve, setResolve] = useState<(value: boolean) => void>(() => { });

  const confirm = (opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise((res) => {
      setResolve(() => res);
    });
  };

  const handleConfirm = () => {
    setIsOpen(false);
    resolve(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolve(false);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && options && (
        <ConfirmModal
          options={options}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

// Internal Modal Component
const ConfirmModal: React.FC<{
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ options, onConfirm, onCancel }) => {
  const { title, message, confirmText, cancelText, type = 'info' } = options;

  const iconMap = {
    danger: { icon: 'report_problem', color: 'text-red-500', bg: 'bg-red-50', btn: 'bg-red-600 hover:bg-red-700' },
    warning: { icon: 'warning', color: 'text-amber-500', bg: 'bg-amber-50', btn: 'bg-amber-600 hover:bg-amber-700' },
    info: { icon: 'info', color: 'text-indigo-500', bg: 'bg-indigo-50', btn: 'bg-indigo-600 hover:bg-indigo-700' },
  };

  const theme = iconMap[type];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 space-y-6 shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className={`w-20 h-20 ${theme.bg} rounded-3xl flex items-center justify-center shadow-inner`}>
            <span className={`material-icons text-4xl ${theme.color}`}>{theme.icon}</span>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              {title || (type === 'danger' ? 'Xác nhận xóa?' : 'Xác nhận?')}
            </h3>
            <p className="text-sm font-medium text-slate-500 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {!options.isAlert && (
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              {cancelText || 'Hủy bỏ'}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`flex-1 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-100 transition-all hover:-translate-y-1 active:translate-y-0 ${theme.btn}`}
          >
            {confirmText || 'Đồng ý'}
          </button>
        </div>
      </div>
    </div>
  );
};
