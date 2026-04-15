/**
 * PlaceholderScreen Component
 * Temporary placeholder for screens under development
 */

import './PlaceholderScreen.css';

interface PlaceholderScreenProps {
  name: string;
}

export function PlaceholderScreen({ name }: PlaceholderScreenProps) {
  return (
    <div className="placeholder-screen">
      <h2 className="placeholder-title">{name}</h2>
      <p className="placeholder-message">Screen coming soon...</p>
    </div>
  );
}
