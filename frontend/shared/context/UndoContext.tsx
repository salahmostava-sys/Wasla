import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';

export type UndoAction = {
  id: string;
  description: string;
  undoCommand: () => Promise<void>;
};

interface UndoContextType {
  registerAction: (action: Omit<UndoAction, 'id'>) => void;
  undoLastAction: () => Promise<void>;
  hasActions: boolean;
}

const UndoContext = createContext<UndoContextType | null>(null);

export function UndoProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [actionStack, setActionStack] = useState<UndoAction[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);

  const registerAction = useCallback((action: Omit<UndoAction, 'id'>) => {
    const newAction: UndoAction = { ...action, id: crypto.randomUUID() };
    setActionStack(prev => [...prev, newAction].slice(-20)); // Keep last 20 actions
    
    // Optional: show toast with undo button
    toast((t) => (
      <div className="flex items-center justify-between gap-4 w-full">
        <span className="text-sm font-medium">{action.description}</span>
        <button
          onClick={async () => {
            toast.dismiss(t.id);
            await handleUndo(newAction.id);
          }}
          className="text-xs px-2 py-1 bg-primary/20 text-primary hover:bg-primary/30 rounded font-bold transition-colors"
        >
          تراجع (Ctrl+Z)
        </button>
      </div>
    ), { duration: 6000, position: 'bottom-left' });
  }, []);

  const handleUndo = async (actionId?: string) => {
    if (isUndoing) return;
    
    let actionToUndo: UndoAction | undefined;
    
    if (actionId) {
      actionToUndo = actionStack.find(a => a.id === actionId);
      if (actionToUndo) {
        setActionStack(prev => prev.filter(a => a.id !== actionId));
      }
    } else {
      actionToUndo = actionStack[actionStack.length - 1];
      if (actionToUndo) {
        setActionStack(prev => prev.slice(0, -1));
      }
    }

    if (!actionToUndo) return;

    setIsUndoing(true);
    const toastId = toast.loading('جاري التراجع...');
    try {
      await actionToUndo.undoCommand();
      toast.success(`تم التراجع: ${actionToUndo.description}`, { id: toastId });
    } catch (error) {
      console.error('Undo failed:', error);
      toast.error('فشل التراجع عن العملية', { id: toastId });
      // Put it back in stack if it failed? Let's just leave it out to avoid infinite loops
    } finally {
      setIsUndoing(false);
    }
  };

  const undoLastAction = useCallback(async () => {
    await handleUndo();
  }, [actionStack, isUndoing]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        // Prevent default only if we are not in an input/textarea
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        
        // If we're in an input, let the browser handle native text undo.
        if (isInput) return;

        if (actionStack.length > 0) {
          e.preventDefault();
          undoLastAction();
        }
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [actionStack, undoLastAction]);

  const hasActions = actionStack.length > 0;
  const contextValue = useMemo(
    () => ({ registerAction, undoLastAction, hasActions }),
    [registerAction, undoLastAction, hasActions],
  );

  return (
    <UndoContext.Provider value={contextValue}>
      {children}
    </UndoContext.Provider>
  );
}

export function useUndo() {
  const context = useContext(UndoContext);
  if (!context) {
    throw new Error('useUndo must be used within an UndoProvider');
  }
  return context;
}
