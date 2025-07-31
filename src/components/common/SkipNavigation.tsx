import React from 'react';

export const SkipNavigation: React.FC = () => {
  return (
    <a
      href="#main-content"
      className="skip-nav"
      tabIndex={1}
    >
      Skip to main content
    </a>
  );
};