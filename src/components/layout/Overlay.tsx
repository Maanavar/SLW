/**
 * Overlay Component
 * Mobile sidebar backdrop that closes when clicked
 */

import './Overlay.css';

interface OverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Overlay({ isOpen, onClose }: OverlayProps) {
  if (!isOpen) {
    return null;
  }

  return <div className="overlay" onClick={onClose} />;
}
