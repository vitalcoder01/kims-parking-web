import React from 'react';
import {PressableScale} from '../components/PressableScale';
import {useAuth} from '../context/AuthContext';
import {useTheme} from '../context/ThemeContext';
import {Icon} from '../components/Icon';

export function VirtualCardScreen({onBack}: {onBack: () => void}) {
  const {user} = useAuth();
  const {colors, isDark} = useTheme();

  const digits = (user?.cardCode ?? '---').split('');

  const glassCardStyle: React.CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.25)' : '0 2px 10px rgba(0, 0, 0, 0.03)',
  };

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background, paddingBottom: 40}}>
      {/* Workstation Top Navigation Bar */}
      <div style={{
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
      }}>
        <PressableScale
          onClick={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            border: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.cardAlt,
            cursor: 'pointer',
          }}>
          <Icon name="back" size={18} color={colors.textPrimary} />
        </PressableScale>

        <div style={{textAlign: 'center'}}>
          <div style={{fontSize: 14, fontWeight: 900, color: colors.textPrimary, letterSpacing: -0.2}}>
            Digital Valet Pass
          </div>
          <div style={{fontSize: 10.5, fontWeight: 700, color: colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase'}}>
            KIMS Hospitals
          </div>
        </div>

        <div style={{width: 36}} />
      </div>

      <div style={{padding: '20px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{fontSize: 13, textAlign: 'center', marginBottom: 20, color: colors.textSecondary, lineHeight: '19px', maxWidth: 300}}>
          Present this 3-digit code to the curbside valet operator for instant key handover.
        </div>

        {/* 1. Executive Digital Metal/Glass Card */}
        <div style={{
          width: '100%',
          borderRadius: 22,
          padding: 22,
          marginBottom: 20,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: colors.primary,
          boxShadow: isDark ? '0 12px 32px rgba(0,0,0,0.5)' : '0 8px 24px rgba(37,99,235,0.22)',
          border: '1px solid rgba(255,255,255,0.25)',
        }}>
          {/* Card Brand Header */}
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24}}>
            <div>
              <div style={{color: '#fff', fontSize: 16, fontWeight: 900, letterSpacing: -0.2}}>
                KIMS HOSPITALS
              </div>
              <div style={{color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 700, marginTop: 1, letterSpacing: 0.5}}>
                Medical Staff Valet Pass
              </div>
            </div>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.25)',
            }}>
              <Icon name="hospital" size={19} color="#fff" />
            </div>
          </div>

          {/* 3 High-Visibility Tabular Digit Wells */}
          <div style={{display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 26}}>
            {digits.map((d, i) => (
              <div
                key={i}
                style={{
                  width: 72,
                  height: 84,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid rgba(255,255,255,0.35)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}>
                <span style={{
                  color: '#fff',
                  fontSize: 42,
                  fontWeight: 900,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: -1,
                }}>
                  {d}
                </span>
              </div>
            ))}
          </div>

          {/* Card Footer Details */}
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
            <div>
              <div style={{color: 'rgba(255,255,255,0.65)', fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase'}}>
                PASS HOLDER
              </div>
              <div style={{color: '#fff', fontSize: 14, fontWeight: 800, marginTop: 2}}>
                {user?.name ?? '—'}
              </div>
            </div>

            <div style={{textAlign: 'right'}}>
              <div style={{color: 'rgba(255,255,255,0.65)', fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase'}}>
                DEPARTMENT
              </div>
              <div style={{color: '#fff', fontSize: 14, fontWeight: 800, marginTop: 2}}>
                {user?.department ?? user?.role?.toUpperCase()}
              </div>
            </div>
          </div>

          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            backgroundColor: 'rgba(255,255,255,0.2)',
          }} />
        </div>

        {/* 2. Seamless Check-In Workflow Instructions */}
        <div style={{...glassCardStyle, width: '100%', padding: 18, marginBottom: 16}}>
          <div style={{fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 14}}>
            How Curbside Valet Works
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            {[
              {step: '1', title: 'Curbside Arrival', desc: 'Pull up to the front entrance gate'},
              {step: '2', title: 'Hand Over Key', desc: 'Pass vehicle keys to on-duty valet operator'},
              {step: '3', title: 'Verify Pass Code', desc: 'Show this 3-digit card code for atomic assignment'},
              {step: '4', title: 'Live Bay Tracking', desc: 'Monitor parking slot & retrieve car from Home tab'},
            ].map(({step, title, desc}) => (
              <div key={step} style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
                  border: `1px solid ${colors.primary}40`,
                }}>
                  <span style={{fontSize: 12.5, fontWeight: 900, color: colors.primary}}>
                    {step}
                  </span>
                </div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontSize: 13, fontWeight: 800, color: colors.textPrimary}}>
                    {title}
                  </div>
                  <div style={{fontSize: 11.5, fontWeight: 600, color: colors.textSecondary, marginTop: 1}}>
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Employee Identification Pill */}
        {user?.employeeId && (
          <div style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: colors.textSecondary,
            padding: '4px 12px',
            borderRadius: 8,
            backgroundColor: colors.cardAlt,
            border: `1px solid ${colors.border}`,
            fontVariantNumeric: 'tabular-nums',
          }}>
            Hospital Employee ID: {user.employeeId}
          </div>
        )}
      </div>
    </div>
  );
}
