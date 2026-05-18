import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Alert from './Alert';

describe('Alert', () => {
  it('renders error message', () => {
    render(<Alert type="error">Something failed</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something failed');
    expect(screen.getByRole('alert')).toHaveClass('alert-error');
  });

  it('renders nothing when empty', () => {
    const { container } = render(<Alert type="info">{null}</Alert>);
    expect(container.firstChild).toBeNull();
  });
});
