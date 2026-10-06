import React, {useState} from 'react';
import {useTheme} from '../../context/ThemeContext';
import {Icon, IconName} from '../Icon';
import {Text} from './Text';
import {radius as radiusTokens} from '../../theme';

interface FieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'tel' | 'email' | 'number';
  leftIcon?: IconName;
  /** Rendered at the right edge inside the field (e.g. a password-reveal toggle). */
  trailing?: React.ReactNode;
  error?: string;
  helper?: string;
  onEnter?: () => void;
  autoFocus?: boolean;
  name?: string;
  disabled?: boolean;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoCapitalize?: string;
  autoComplete?: string;
  style?: React.CSSProperties;
}

/**
 * Labelled text field with a resting fill and a border that appears only on
 * focus or error — a calm field at rest, a clear one when it matters. One
 * component so every form (login, sign-up, vehicle setup, visitor intake)
 * uses the same field anatomy and the same focus/error language.
 */
export const Field = React.forwardRef<HTMLInputElement, FieldProps>(function Field({
  label, value, onChange, placeholder, type = 'text', leftIcon, trailing,
  error, helper, onEnter, autoFocus, name, disabled, maxLength, inputMode,
  autoCapitalize, autoComplete, style,
}, ref) {
  const {colors, isDark} = useTheme();
  const [focused, setFocused] = useState(false);

  const fill = isDark ? colors.card : colors.cardAlt;
  const borderColor = error ? colors.error : focused ? colors.primary : 'transparent';

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 8, ...style}}>
      {label && <Text variant="label" tone="secondary" as="label">{label}</Text>}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        border: `1.5px solid ${borderColor}`,
        borderRadius: radiusTokens.lg,
        padding: '0 14px', height: 54,
        backgroundColor: fill,
        transition: 'border-color 160ms cubic-bezier(0.2,0,0,1)',
      }}>
        {leftIcon && <Icon name={leftIcon} size={18} color={focused ? colors.textSecondary : colors.textMuted} />}
        <input
          ref={ref}
          name={name}
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          inputMode={inputMode}
          autoFocus={autoFocus}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter(); }}
          style={{
            flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none',
            fontSize: 15.5, fontWeight: 600, color: colors.textPrimary,
          }}
        />
        {trailing}
      </div>
      {(error || helper) && (
        <div style={{display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 2}}>
          {error && <Icon name="alert" size={13} color={colors.error} />}
          <Text variant="caption" tone={error ? 'error' : 'muted'}>{error || helper}</Text>
        </div>
      )}
    </div>
  );
});
