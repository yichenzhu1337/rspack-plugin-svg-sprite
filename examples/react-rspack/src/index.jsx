import { createRoot } from 'react-dom/client';
import App from './App';
import './icons';
import './theme';
import './video';
import { highlightAll } from './highlight';
import { showSpriteSize } from './stats';
import './styles.css';

createRoot(document.getElementById('flag-wall')).render(<App />);
showSpriteSize();
highlightAll();
