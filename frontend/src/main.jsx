import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';

var isAdmin = window.location.pathname.indexOf('/admin') === 0;

if (isAdmin) {
  import('./pages/AdminPage.jsx').then(function(mod) {
    var AdminPage = mod.default;
    createRoot(document.getElementById('root')).render(
      React.createElement(React.StrictMode, null,
        React.createElement(AdminPage)
      )
    );
  });
} else {
  import('./App.jsx').then(function(mod) {
    var App = mod.default;
    createRoot(document.getElementById('root')).render(
      React.createElement(React.StrictMode, null,
        React.createElement(App)
      )
    );
  });
}
