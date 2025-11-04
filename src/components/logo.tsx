
import React from 'react';

export function Logo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 52"
      width="180"
      height="30"
      {...props}
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: 'hsl(var(--primary))', stopOpacity: 1}} />
          <stop offset="100%" style={{stopColor: 'hsl(var(--accent))', stopOpacity: 1}} />
        </linearGradient>
      </defs>
      <g>
        {/* Simple box icon */}
        <rect x="10" y="10" width="30" height="30" rx="3" fill="url(#logoGradient)"/>
        <rect x="15" y="5" width="20" height="10" rx="2" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.5" />
         <rect x="15" y="20" width="20" height="10" rx="2" fill="hsl(var(--background))" stroke="hsl(var(--accent))" strokeWidth="1.5" />
      </g>
      <text
        x="50"
        y="36"
        fontFamily="var(--font-space-grotesk), sans-serif"
        fontSize="30"
        fontWeight="bold"
        fill="hsl(var(--foreground))"
      >
        SmartInventory
      </text>
    </svg>
  );
}
