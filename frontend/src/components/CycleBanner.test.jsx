import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CycleBanner from './CycleBanner';

describe('CycleBanner', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              bypass: false,
              activeLabel: 'Goal Setting & Approval',
              windows: [
                { id: 'GOAL_SETTING', label: 'Goal Setting', isOpen: true },
                { id: 'Q1', label: 'Q1 Check-in', isOpen: false },
              ],
            }),
        })
      )
    );
  });

  it('loads cycle status and displays active window', async () => {
    render(<CycleBanner token="test-token" />);
    await waitFor(() => {
      expect(screen.getByTestId('cycle-banner')).toBeInTheDocument();
    });
    expect(screen.getByText(/Goal Setting & Approval/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/cycles/status', {
      headers: { Authorization: 'Bearer test-token' },
    });
  });
});
