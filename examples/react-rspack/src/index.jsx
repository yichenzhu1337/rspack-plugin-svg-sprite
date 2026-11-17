import { createRoot } from 'react-dom/client';
import App from './App';
import './icons';
import './theme';
import { showSpriteSize } from './stats';
import './styles.css';

createRoot(document.getElementById('flag-wall')).render(<App />);
showSpriteSize();
