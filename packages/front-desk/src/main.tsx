import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import FrontDeskApp from './FrontDeskApp';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FrontDeskApp />
  </StrictMode>,
);
