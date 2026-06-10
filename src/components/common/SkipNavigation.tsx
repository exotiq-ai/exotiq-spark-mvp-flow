import React from 'react';

export const SkipNavigation: React.FC = () => {
  return (
    <a
      href="#main-content"
      className="skip-nav"
      tabIndex={0}
    >
      Skip to main content
    </a>
  );
};