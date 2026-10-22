import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { copy } from './core/copy';
import './styles.css';

document.title = copy.app.title;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
