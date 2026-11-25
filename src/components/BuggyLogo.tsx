import React from 'react';

interface BuggyLogoProps {
  size?: number;
  className?: string;
}

export const BuggyLogo: React.FC<BuggyLogoProps> = ({ size = 24, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Clean geometric scarab/circuit emblem for BUGGY AI */}
      <rect
        x="8"
        y="9"
        width="16"
        height="16"
        rx="8"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16 9V25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M11.5 6.5L13.5 9.5M20.5 6.5L18.5 9.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M5 14H8M5 19H8M24 14H27M24 19H27"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="16" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
};
