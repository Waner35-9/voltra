import React from 'react'
import ReactDOM from 'react-dom/client'
// @ts-ignore
import './pwa'
// @ts-ignore
import App from './App'
// @ts-ignore
import { MiseAJour, FondBarreEtat } from './MiseAJour'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <FondBarreEtat />
    <MiseAJour />
  </React.StrictMode>
)
