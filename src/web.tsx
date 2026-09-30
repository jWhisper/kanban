import { createRoot } from 'react-dom/client';
import { Workbench } from './ui/Workbench';
import { webAPI } from './api';
import './styles.css';
createRoot(document.getElementById('root')!).render(<Workbench api={webAPI} />);
