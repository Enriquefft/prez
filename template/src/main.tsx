import React from 'react'
import ReactDOM from 'react-dom/client'
import { Deck } from 'prez'
import Slides from './slides'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Deck>
      <Slides />
    </Deck>
  </React.StrictMode>,
)
