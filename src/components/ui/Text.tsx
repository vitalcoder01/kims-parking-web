import React from 'react';
import {useTheme} from '../../context/ThemeContext';
import {text as typeRamp, type TypePreset} from '../../theme';

type Variant = keyof typeof typeRamp;
type Tone = 'primary' | 'secondary' | 'muted' | 'inverse' | 'onPrimary' | 'success' | 'warning' | 'error' | 'info';

interface TextProps {
  variant?: Variant;
  tone?: Tone;
  /** Explicit colour wins over `tone`. */
  color?: string;
  align?: React.CSSProperties['textAlign'];
  uppercase?: boolean;
  /** Clamp to N lines with an ellipsis. */
  numberOfLines?: number;
  as?: 'span' | 'div' | 'p' | 'label' | 'h1' | 'h2' | 'h3';
  htmlFor?: string;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Typed text. A screen writes `<Text variant="title">` instead of re-picking
 * fontSize/weight/lineHeight/letterSpacing by hand, so headings and body copy
 * stay on one rhythm everywhere. Colour follows the theme via `tone`.
 */
export function Text({
  variant = 'body',
  tone = 'primary',
  color,
  align,
  uppercase,
  numberOfLines,
  as = 'span',
  htmlFor,
  style,
  className,
  children,
}: TextProps) {
  const {colors} = useTheme();
  const preset: TypePreset = typeRamp[variant];

  const toneColor: Record<Tone, string> = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    inverse: colors.textInverse,
    onPrimary: colors.textOnPrimary,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
  };

  const clamp: React.CSSProperties = numberOfLines
    ? numberOfLines === 1
      ? {whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block'}
      : {display: '-webkit-box', WebkitLineClamp: numberOfLines, WebkitBoxOrient: 'vertical', overflow: 'hidden'}
    : {};

  const Tag = as as any;
  return (
    <Tag
      htmlFor={as === 'label' ? htmlFor : undefined}
      className={className}
      style={{
        fontSize: preset.fontSize,
        fontWeight: preset.fontWeight,
        lineHeight: preset.lineHeight,
        letterSpacing: preset.letterSpacing,
        color: color ?? toneColor[tone],
        textAlign: align,
        textTransform: uppercase ? 'uppercase' : undefined,
        margin: 0,
        ...clamp,
        ...style,
      }}>
      {children}
    </Tag>
  );
}
