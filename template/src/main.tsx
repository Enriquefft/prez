import React from 'react'
import ReactDOM from 'react-dom/client'
import { Deck } from 'prez'
import slides from './slides'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Deck>
      {slides}
    </Deck>
  </React.StrictMode>,
)
