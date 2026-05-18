import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from './StatCard';

describe('StatCard', () => {
  it('shows label and value', () => {
    render(<StatCard label="Locked sheets" value={3} hint="Phase 1" />);
    expect(screen.getByText('Locked sheets')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Phase 1')).toBeInTheDocument();
  });

  it('renders weight meter when provided', () => {
    const { container } = render(<StatCard label="Weight" value="100%" meter={100} />);
    expect(container.querySelector('.weight-meter-fill--ok')).toBeTruthy();
  });
});
