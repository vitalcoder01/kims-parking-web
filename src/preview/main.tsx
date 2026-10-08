import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import {ThemeProvider} from '../context/ThemeContext';
import {Preview} from './Preview';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Preview />
    </ThemeProvider>
  </React.StrictMode>,
);
