import { create } from 'zustand';

type Theme = 'dark';
type ActivePanel = 'serial' | 'firmware' | 'build';

interface UIState {
    theme: Theme;
    activePanel: ActivePanel;
    sidebarOpen: boolean;
    bottomPanelHeight: number;

    setActivePanel: (p: ActivePanel) => void;
    setSidebarOpen: (v: boolean) => void;
    setBottomPanelHeight: (h: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
    theme: 'dark',
    activePanel: 'serial',
    sidebarOpen: true,
    bottomPanelHeight: 220,

    setActivePanel: (activePanel) => set({ activePanel }),
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    setBottomPanelHeight: (bottomPanelHeight) => set({ bottomPanelHeight }),
}));
