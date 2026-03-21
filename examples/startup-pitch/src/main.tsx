import { Deck } from '@enriquefft/prez'
import React from 'react'
import ReactDOM from 'react-dom/client'
import slides from './slides'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Deck transition="fade">
      {slides}
    </Deck>
  </React.StrictMode>,
)
