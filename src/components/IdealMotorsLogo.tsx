import React from "react";

interface IdealMotorsLogoProps {
  className?: string;
  lightMode?: boolean;
}

export default function IdealMotorsLogo({ className = "h-10", lightMode = false }: IdealMotorsLogoProps) {
  const motorsColor = lightMode ? "#1E293B" : "#FFFFFF";
  
  return (
    <svg 
      viewBox="0 0 280 85" 
      className={className} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Curved emblem block (rounded rectangle in deep charcoal/black background) */}
      <rect x="2" y="2" width="80" height="80" rx="12" fill="#000000" />
      
      {/* 3 Red swooshes + 1 Silver swoosh */}
      {/* Red Swoosh Top */}
      <path d="M 10 18 C 33 18 66 32 70 70 C 63 70 58 68 53 64 C 43 42 23 28 10 28 Z" fill="#EF4444" />
      {/* Silver Swoosh Middle-Top */}
      <path d="M 10 34 C 28 34 56 46 60 70 C 54 70 50 68 46 64 C 38 48 22 38 10 38 Z" fill="#94A3B8" />
      {/* Red Swoosh Middle-Bottom */}
      <path d="M 10 50 C 22 50 46 58 50 70 C 45 70 42 68 39 65 C 31 55 19 52 10 52 Z" fill="#EF4444" />
      {/* Red Swoosh Bottom */}
      <path d="M 10 66 C 16 66 30 68 33 70 C 29 70 27 69 25 68 C 19 66 14 66 10 66 Z" fill="#EF4444" />

      {/* "IDEAL" (Bold uppercase red text) */}
      <text x="96" y="44" fill="#EF4444" fontFamily="'Inter', system-ui, sans-serif" fontWeight="900" fontSize="38" fontStyle="italic" letterSpacing="-1">IDEAL</text>
      
      {/* "Motors" (Bold italic silver/white text) */}
      <text x="96" y="74" fill={motorsColor} fontFamily="'Inter', system-ui, sans-serif" fontWeight="700" fontSize="28" fontStyle="italic" letterSpacing="-0.5">Motors</text>
    </svg>
  );
}
