import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import {ThemeProvider} from '../context/ThemeContext';
import {Gallery} from './Gallery';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Gallery />
    </ThemeProvider>
  </React.StrictMode>,
);
