import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import App from '../App';

it('opens Chat and shows the persisted default Rules v2 badge', () => {
  render(<App />);
  expect(screen.getByText('Rules v2')).toBeDefined();
  expect(screen.getByRole('tab', { name: 'Chat' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('tabpanel').querySelector('h2')?.textContent).toBe('Chat');
  expect(screen.getByRole('textbox')).toBeDefined();
});

it('switches between all three shell panels and back to Chat', () => {
  render(<App />);
  for (const name of ['History', 'Settings', 'Chat']) {
    fireEvent.click(screen.getByRole('tab', { name }));
    expect(screen.getByRole('tabpanel').querySelector('h2')?.textContent).toBe(name);
    expect(screen.getByRole('tab', { name }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('tab').filter((tab) => tab.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  }
});
