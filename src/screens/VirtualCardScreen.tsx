import React from 'react';
import {PressableScale} from '../components/PressableScale';
import {useAuth} from '../context/AuthContext';
import {useTheme} from '../context/ThemeContext';
import {Icon} from '../components/Icon';

export function VirtualCardScreen({onBack}: {onBack: () => void}) {
  const {user} = useAuth();
  const {colors} = useTheme();

  const digits = (user?.cardCode ?? '---').split('');

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background}}>
      <PressableScale
        onClick={onBack}
        style={{
          width: 36, height: 36, borderRadius: 18, border: `1px solid ${colors.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '12px 0 0 16px', backgroundColor: colors.surface,
        }}>
        <Icon name="back" size={18} color={colors.textPrimary} />
      </PressableScale>

      <div style={{padding: '12px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>

        <div style={{fontSize: 22, fontWeight: 900, marginBottom: 6, color: colors.textPrimary}}>Your Valet Card</div>
        <div style={{fontSize: 13, textAlign: 'center', marginBottom: 32, lineHeight: '18px', color: colors.textSecondary}}>
          Show this code to the valet when you arrive
        </div>

        {/* Card */}
        <div style={{
          width: '100%', borderRadius: 24, padding: 24, marginBottom: 24,
          overflow: 'hidden', position: 'relative', backgroundColor: colors.primary,
          boxShadow: '0 12px 20px rgba(0,0,0,0.3)',
        }}>
          <div className="glow" style={{
            position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.06)', pointerEvents: 'none',
          }} />

          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32}}>
            <div>
              <div style={{color: '#fff', fontSize: 16, fontWeight: 900}}>KIMS Hospital</div>
              <div style={{color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, marginTop: 2}}>Valet Parking</div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="hospital" size={20} color="#fff" />
            </div>
          </div>

          <div style={{display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 32}}>
            {digits.map((d, i) => (
              <div key={i} style={{
                width: 70, height: 80, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid rgba(255,255,255,0.3)',
              }}>
                <span style={{color: '#fff', fontSize: 40, fontWeight: 900, fontVariantNumeric: 'tabular-nums'}}>{d}</span>
              </div>
            ))}
          </div>

          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <div>
              <div style={{color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: 700, letterSpacing: 1.5}}>NAME</div>
              <div style={{color: '#fff', fontSize: 13, fontWeight: 800, marginTop: 2}}>{user?.name}</div>
            </div>
            <div style={{textAlign: 'right'}}>
              <div style={{color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: 700, letterSpacing: 1.5}}>DEPT</div>
              <div style={{color: '#fff', fontSize: 13, fontWeight: 800, marginTop: 2}}>{user?.department ?? user?.role?.toUpperCase()}</div>
            </div>
          </div>

          <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.15)'}} />
        </div>

        {/* Instructions */}
        <div style={{
          width: '100%', borderRadius: 16, border: `1px solid ${colors.border}`, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16,
          backgroundColor: colors.surface,
        }}>
          {[
            {step: '1', text: 'Arrive at the hospital entrance'},
            {step: '2', text: 'Hand your car keys to the valet'},
            {step: '3', text: 'Show this 3-digit code for identification'},
            {step: '4', text: 'Track your car live in the Parking tab'},
          ].map(({step, text}) => (
            <div key={step} style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <div style={{
                width: 28, height: 28, borderRadius: 14, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: colors.primary + '18',
              }}>
                <span style={{fontSize: 13, fontWeight: 800, color: colors.primary}}>{step}</span>
              </div>
              <span style={{fontSize: 13, fontWeight: 500, flex: 1, color: colors.textSecondary}}>{text}</span>
            </div>
          ))}
        </div>

        <div style={{fontSize: 11, fontWeight: 600, color: colors.textMuted}}>
          Employee ID: {user?.employeeId}
        </div>
      </div>
    </div>
  );
}
