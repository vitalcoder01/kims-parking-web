import React from 'react';
import { formatPlate } from '../utils/plate';

interface Props {
  plate: string;
  size?: 'sm' | 'md' | 'lg';
  highlightQuery?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Automotive-grade Indian HSRP license plate badge.
 * Provides high contrast and immediate legibility in direct sunlight at valet stations.
 */
export function VehiclePlateBadge({ plate, size = 'md', highlightQuery, className, style }: Props) {
  const formatted = formatPlate(plate) || plate.toUpperCase();

  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const fontSize = isSm ? 12 : isLg ? 17 : 14;
  const paddingY = isSm ? 2 : isLg ? 5 : 3.5;
  const paddingX = isSm ? 7 : isLg ? 11 : 9;
  const indFontSize = isSm ? 7 : isLg ? 9 : 8;

  // Render highlighted segment if query matches
  const renderText = () => {
    if (!highlightQuery || highlightQuery.trim().length < 2) {
      return formatted;
    }
    const cleanQ = highlightQuery.trim().toUpperCase();
    const parts = formatted.split(new RegExp(`(${cleanQ})`, 'gi'));
    return parts.map((part, i) => (
      part.toUpperCase() === cleanQ ? (
        <span
          key={i}
          style={{
            backgroundColor: '#FEF08A',
            color: '#854D0E',
            borderRadius: 2,
            padding: '0 2px',
          }}
        >
          {part}
        </span>
      ) : (
        part
      )
    ));
  };

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        border: '1.5px solid #1E293B',
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
        userSelect: 'none',
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Blue IND stripe */}
      <div
        style={{
          backgroundColor: '#1E40AF',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `0 ${isSm ? 3 : 4}px`,
          alignSelf: 'stretch',
          borderRight: '1px solid #1E3A8A',
        }}
      >
        <span
          style={{
            fontSize: indFontSize,
            fontWeight: 900,
            letterSpacing: 0.5,
            lineHeight: 1,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          IND
        </span>
      </div>

      {/* Plate characters */}
      <div
        style={{
          padding: `${paddingY}px ${paddingX}px`,
          fontFamily: "'SF Mono', 'JetBrains Mono', 'Roboto Mono', Menlo, Consolas, monospace",
          fontSize,
          fontWeight: 800,
          letterSpacing: '0.12em',
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {renderText()}
      </div>
    </div>
  );
}
