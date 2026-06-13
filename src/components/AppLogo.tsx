import React from 'react';

interface AppLogoProps {
  className?: string; // Additional classes for positioning
  size?: number; // Visual size in pixels
  whiteText?: boolean; // Changes arched text color to white for dark backgrounds
  forceDarkBg?: boolean; // Forces the wheel background to be dark charcoal
}

export default function AppLogo({ 
  className = '', 
  size = 54, 
  whiteText = false,
  forceDarkBg = false
}: AppLogoProps) {
  // Gold accent color matching the physical logo
  const goldColor = '#C5A55C';

  return (
    <div 
      className={`flex items-center justify-center shrink-0 ${className}`} 
      style={{ width: size, height: size }}
      id="app-brand-logo-container"
    >
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 200 200" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="select-none"
      >
        {/* Concentric curved helper path for arched text 'GUARDIÕES VILAGE INN' */}
        {/* We use a path that starts left and sweeps to the right upper arc */}
        <path 
          id="text-curve-path-upper" 
          d="M 12,105 A 88,88 0 0,1 188,105" 
          fill="transparent" 
        />
        
        {/* Arched typography 'GUARDIÕES DO ATENDIMENTO' arched over the top */}
        <text className="font-sans font-bold text-[12.5px] uppercase tracking-[0.14em]">
          <textPath 
            href="#text-curve-path-upper" 
            startOffset="50%" 
            textAnchor="middle"
            fill={whiteText ? '#FFFFFF' : goldColor}
          >
            Guardiões do Atendimento
          </textPath>
        </text>

        {/* Outer Thin Golden Border Wheel */}
        <circle 
          cx="100" 
          cy="120" 
          r="62" 
          stroke={goldColor} 
          strokeWidth="1.5" 
          fill="transparent" 
        />

        {/* Gray/White background disk */}
        <circle 
          cx="100" 
          cy="120" 
          r="60" 
          fill={forceDarkBg ? '#1D2424' : '#1D2424'} 
        />

        {/* Quadrant 1, Top-Left: Google Logo */}
        {/* We represent each segment as a clean path slice with gold borders */}
        <path 
          d="M 98,118 L 47,118 A 53,53 0 0,1 98,67 Z" 
          fill="#242C2C" 
          stroke={goldColor} 
          strokeWidth="2" 
        />
        {/* Google G Brand Vector */}
        <g transform="translate(62, 82) scale(1.15)">
          <path d="M19.6 10.2c0-.7-.1-1.4-.2-2H10v3.8h5.4c-.2 1.2-.9 2.2-2 2.9v2.4h3.1c1.8-1.7 2.9-4.2 2.9-7.1z" fill="#4285F4"/>
          <path d="M10 20c2.7 0 5-1 6.6-2.6l-3.1-2.4c-.9.6-2 .9-3.5.9-2.7 0-4.9-1.8-5.7-4.2H1.1v2.5C2.8 17.5 6.1 20 10 20z" fill="#34A853"/>
          <path d="M4.3 11.7c-.2-.6-.3-1.2-.3-1.7s.1-1.1.3-1.7V5.8H1.1C.4 7.1 0 8.5 0 10s.4 2.9 1.1 4.2l3.2-2.5z" fill="#FBBC05"/>
          <path d="M10 3.8c1.5 0 2.8.5 3.8 1.5l2.9-2.9C15 1 12.7 0 10 0 6.1 0 2.8 2.5 1.1 5.8l3.2 2.5c.8-2.4 3-4.5 5.7-4.5z" fill="#EA4335"/>
        </g>

        {/* Quadrant 2, Top-Right: Booking.com */}
        <path 
          d="M 102,118 L 102,67 A 53,53 0 0,1 153,118 Z" 
          fill="#242C2C" 
          stroke={goldColor} 
          strokeWidth="2" 
        />
        {/* Booking.com B. Icon */}
        <g transform="translate(116, 83) scale(1.2)">
          <rect width="18" height="18" rx="3.5" fill="#003580" />
          <text x="3.5" y="13.5" fill="#FFFFFF" className="font-sans font-bold text-[12px] tracking-tight">B.</text>
        </g>

        {/* Quadrant 3, Bottom-Left: My Hotel Star */}
        <path 
          d="M 98,122 L 47,122 A 53,53 0 0,0 98,173 Z" 
          fill="#242C2C" 
          stroke={goldColor} 
          strokeWidth="2" 
        />
        {/* My Hotel Logo with 'MH' and a Gold Star */}
        <g transform="translate(60, 126) scale(1.05)">
          {/* Star symbol rotated slightly to fit */}
          <polygon points="12,1 14,5.5 19,5.5 15,8.5 17,13.5 12,10.5 7,13.5 9,8.5 5,5.5 10,5.5" fill={goldColor} />
          {/* MH Text styled styled elegant sans */}
          <text x="-1" y="24" fill={goldColor} className="font-sans font-black text-[10px] tracking-tighter">M</text>
          <text x="9.5" y="24" fill="#FFFFFF" className="font-sans font-black text-[10px] tracking-tighter">H</text>
          <text x="-1.5" y="32" fill="#D1D5DB" className="font-sans font-medium text-[5.5px] uppercase tracking-[0.05em]">My Hotel</text>
        </g>

        {/* Quadrant 4, Bottom-Right: TripAdvisor owl eyes inside a circle background */}
        <path 
          d="M 102,122 L 102,173 A 53,53 0 0,0 153,122 Z" 
          fill="#242C2C" 
          stroke={goldColor} 
          strokeWidth="2" 
        />
        {/* TripAdvisor owl representation */}
        <g transform="translate(114, 126) scale(1.1)">
          {/* TripAdvisor green badge backing */}
          <circle cx="11" cy="11" r="10" fill="#34E0A1" />
          
          {/* Owl eyes white glasses outline */}
          <circle cx="7" cy="11.5" r="4" fill="#FFFFFF" />
          <circle cx="15" cy="11.5" r="4" fill="#FFFFFF" />
          
          {/* Dark pupil circles inside */}
          <circle cx="7" cy="11.5" r="2.2" fill="#242C2C" />
          <circle cx="15" cy="11.5" r="2.2" fill="#242C2C" />
          
          {/* TripAdvisor inner green pupils */}
          <circle cx="7.7" cy="11.5" r="1" fill="#34E0A1" />
          <circle cx="14.3" cy="11.5" r="1" fill="#34E0A1" />

          {/* Owl Beak */}
          <polygon points="11,12.5 9.5,15 12.5,15" fill="#242C2C" />

          {/* TripAdvisor text banner underneath */}
          <text x="1" y="27" fill="#FFFFFF" className="font-sans font-semibold text-[5.5px] uppercase tracking-wide">tripadvisor</text>
        </g>

        {/* Center Hollow Axis - White with Gold Outline, locking the 4 sections */}
        <circle 
          cx="100" 
          cy="120" 
          r="10" 
          fill="#FFFFFF" 
          stroke={goldColor} 
          strokeWidth="1.5" 
        />
      </svg>
    </div>
  );
}
