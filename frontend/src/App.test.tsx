import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

describe('App navigation', () => {
  it('shows dashboard widgets by default', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(screen.getByText('Most Important Renewals')).toBeInTheDocument()
    expect(screen.queryByText('Admin Settings')).not.toBeInTheDocument()
  })
})
