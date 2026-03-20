import { Deck } from 'prez'
import React from 'react'
import ReactDOM from 'react-dom/client'
import Slides from './slides'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Deck transition="fade">
      <Slides />
    </Deck>
  </React.StrictMode>,
)
