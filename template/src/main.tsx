import React from 'react'
import ReactDOM from 'react-dom/client'
import { Deck } from '@enriquefft/prez'
import slides from './slides'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Deck downloadUrl={{ pdf: "deck.pdf", pptx: "deck.pptx" }}>
      {slides}
    </Deck>
  </React.StrictMode>,
)
