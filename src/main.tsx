import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyThemeToDocument, loadTheme } from './utils/storage';

// Apply saved/preferred theme before initial render to prevent flash
applyThemeToDocument(loadTheme());

createRoot(document.getElementById('root')!).render(<App />);
