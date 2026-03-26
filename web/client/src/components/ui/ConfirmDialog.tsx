import { useState, useCallback, createContext, useContext, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2, ShieldAlert, X } from "lucide-react";

// ================= TYPES =================
interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  icon?: ReactNode;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
};

// ================= PROVIDER =================
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: ((value: boolean) => void) | null;
  }>({
    open: false,
    options: { title: "" },
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    state.resolve?.(result);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };

  const variantStyles = {
    danger: {
      iconBg: "bg-red-500/10 border-red-500/20",
      iconColor: "text-red-500",
      btnBg: "bg-red-600 hover:bg-red-500 shadow-red-500/30",
      icon: <Trash2 className="w-5 h-5" />,
    },
    warning: {
      iconBg: "bg-amber-500/10 border-amber-500/20",
      iconColor: "text-amber-500",
      btnBg: "bg-amber-600 hover:bg-amber-500 shadow-amber-500/30",
      icon: <AlertTriangle className="w-5 h-5" />,
    },
    info: {
      iconBg: "bg-indigo-500/10 border-indigo-500/20",
      iconColor: "text-indigo-400",
      btnBg: "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30",
      icon: <ShieldAlert className="w-5 h-5" />,
    },
  };

  const v = variantStyles[state.options.variant || "danger"];

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {state.open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
              onClick={() => handleClose(false)}
            />
            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              onClick={(e) => e.target === e.currentTarget && handleClose(false)}
            >
              <div className="w-full max-w-sm bg-white dark:bg-[#111727] border border-slate-200 dark:border-slate-800/60 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
                {/* Close btn */}
                <button
                  onClick={() => handleClose(false)}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="p-6 text-center">
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-2xl ${v.iconBg} border flex items-center justify-center mx-auto mb-4 ${v.iconColor}`}>
                    {state.options.icon || v.icon}
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                    {state.options.title}
                  </h3>

                  {/* Description */}
                  {state.options.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-1">
                      {state.options.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 px-6 pb-6">
                  <button
                    onClick={() => handleClose(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all"
                  >
                    {state.options.cancelText || "Cancel"}
                  </button>
                  <button
                    onClick={() => handleClose(true)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white ${v.btnBg} shadow-lg transition-all hover:scale-[1.02]`}
                  >
                    {state.options.confirmText || "Confirm"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}
