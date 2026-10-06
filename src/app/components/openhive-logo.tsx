import { useId } from 'react';

interface OpenHiveLogoProps {
  size?: number;
  className?: string;
}

export function OpenHiveLogo({ size = 32, className = '' }: OpenHiveLogoProps) {
  const uid = useId();
  const gradId = `mm-grad${uid}`;
  const glowId = `mm-glow${uid}`;

  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 544 544'
      width={size}
      height={size}
      role='img'
      aria-label='HiveX mark white H'
      className={className}>
      <g
        transform='matrix(1.462 0 0 1.462 -144.5 -125.8)'
        fill='none'
        stroke='#6B68F0'
        strokeWidth='22'
        strokeLinecap='round'
        strokeLinejoin='round'>
        <line x1='286.2' y1='110.7' x2='382.9' y2='165.9'></line>
        <polyline points='334.9,410.9 423.7,352.3 428.5,193.0'></polyline>
        <line x1='186.3' y1='377.8' x2='284.6' y2='433.5'></line>
        <polyline points='141.1,349.9 143.9,195.2 234.7,132.9'></polyline>
      </g>
      <g
        transform='matrix(1.462 0 0 1.462 -144.5 -125.8)'
        fill='none'
        stroke='#FFFFFF'
        strokeWidth='23'
        strokeLinecap='round'>
        <line x1='234' y1='209' x2='234' y2='335'></line>
        <line x1='336' y1='209' x2='336' y2='335'></line>
        <line x1='234' y1='271' x2='336' y2='271'></line>
      </g>
    </svg>
  );
}
