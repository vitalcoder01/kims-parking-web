import React, {useEffect, useState} from 'react';
import {useTheme} from '../../context/ThemeContext';
import {PressableScale} from '../PressableScale';
import {Icon} from '../Icon';
import {Creature} from './Creature';
import {useCopilot} from './useCopilot';
import {CopilotPanel} from './CopilotPanel';
import type {Insight} from '../../core/copilot/insights';

/*
 * Where the creature is allowed to be, and when it is allowed to move.
 *
 * Web port of the mobile overlay, with the same roaming rule — it wanders
 * only on an idle screen, and everywhere else it sits in its corner.
 *
 * That constraint is worth defending rather than relaxing. A valet is racing
 * a departure deadline and reading a number plate; a character drifting
 * across that is covering the thing they are trying to read, at the moment
 * they are trying to read it. Clippy is remembered the way it is not for
 * being a character but for interrupting focused work.
 *
 * `canRoam` requires ALL of: the host screen declared itself idle, nothing
 * critical is being reported, no bubble is open, and nobody has interacted
 * for IDLE_BEFORE_ROAM_MS. Fail any one and it returns to the corner.
 */

const IDLE_BEFORE_ROAM_MS = 20_000;
const SIZE = 46;

interface Props {
  /**
   * Whether this screen is a place worth wandering. Hosts opt IN — the
   * default is stillness, so a screen added later cannot accidentally
   * inherit a roaming mascot.
   */
  idleScreen?: boolean;
  onNavigate?: (insight: Insight) => void;
}

export function CopilotOverlay({idleScreen = false, onNavigate}: Props) {
  const {colors} = useTheme();
  const {insights, top, mood, dismiss, disabled} = useCopilot();

  const [expanded, setExpanded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [canRoam, setCanRoam] = useState(false);
  const [idleSince, setIdleSince] = useState(() => Date.now());

  // Any interaction, and any new insight, resets the idle clock — something
  // just happened, so this is not a quiet moment.
  useEffect(() => {
    const bump = () => setIdleSince(Date.now());
    window.addEventListener('pointerdown', bump, true);
    window.addEventListener('keydown', bump, true);
    return () => {
      window.removeEventListener('pointerdown', bump, true);
      window.removeEventListener('keydown', bump, true);
    };
  }, []);

  useEffect(() => { setIdleSince(Date.now()); }, [top?.id]);

  useEffect(() => {
    const allowed = idleScreen && !expanded && top?.severity !== 'critical';
    if (!allowed) { setCanRoam(false); return; }
    const t = window.setTimeout(() => setCanRoam(true), IDLE_BEFORE_ROAM_MS);
    return () => window.clearTimeout(t);
  }, [idleScreen, expanded, top?.severity, idleSince]);

  if (disabled) return null;
  /*
   * Rendered even with nothing to report. The earlier version hid itself on
   * non-idle screens when quiet, which also hid the panel — and the panel is
   * most of the value. Dimmed and breathing slowly when idle, so it costs a
   * corner rather than attention.
   */

  const sev = top?.severity ?? null;

  return (
    <>
    {/*
      * The panel is a SIBLING of the creature, never a child.
      *
      * The creature's container is position:absolute, pointer-events:none and
      * animated while roaming. Nesting the panel inside it made inset:0 size
      * to the 46px creature instead of the frame, left the sheet
      * unclickable, and dragged the whole panel along with the wander.
      */}
    <CopilotPanel
      visible={panelOpen}
      onClose={() => setPanelOpen(false)}
      insights={insights}
      onAct={i => onNavigate?.(i)}
      onDismiss={dismiss}
    />

    <div
      className={canRoam ? 'kp-roaming' : undefined}
      style={{
        position: 'absolute',
        right: 16,
        bottom: 78, // clear of the bottom tab bar
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        pointerEvents: 'none',
        transition: canRoam ? undefined : 'transform 500ms ease',
      }}
    >
      {expanded && top && (
        <div
          style={{
            pointerEvents: 'auto',
            maxWidth: 260,
            borderRadius: 16,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            padding: 14,
            marginBottom: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
          }}
        >
          <div style={{fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: colors.textPrimary}}>
            {top.message}
          </div>
          <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12}}>
            <PressableScale
              onClick={() => { dismiss(top.id); setExpanded(false); }}
              style={{borderRadius: 9, border: `1px solid ${colors.border}`, padding: '7px 12px', background: 'transparent'}}
            >
              <span style={{fontSize: 12, fontWeight: 700, color: colors.textSecondary}}>Dismiss</span>
            </PressableScale>
            {top.action && (
              <PressableScale
                onClick={() => { onNavigate?.(top); setExpanded(false); }}
                style={{borderRadius: 9, border: 'none', padding: '7px 14px', background: colors.primary}}
              >
                <span style={{fontSize: 12, fontWeight: 800, color: colors.textOnPrimary}}>{top.action.label}</span>
              </PressableScale>
            )}
          </div>
        </div>
      )}

      <div style={{display: 'flex', alignItems: 'flex-end', gap: 6, pointerEvents: 'auto'}}>
        {!expanded && top && (
          <PressableScale
            onClick={() => setExpanded(true)}
            style={{
              width: 18, height: 18, borderRadius: 9,
              border: `1px solid ${colors.border}`, background: colors.surface,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2,
            }}
          >
            <Icon name="alert" size={11} color={sev === 'critical' ? '#E5484D' : colors.textSecondary} />
          </PressableScale>
        )}
        {/*
          * Always tappable now, insight or not. It used to be disabled with
          * nothing to report, which made the creature dead weight most of the
          * day — and everything behind the tap (health check, shift summary,
          * find a car, report a problem) is exactly as useful on a quiet
          * shift as a busy one.
          */}
        <PressableScale
          onClick={() => setPanelOpen(true)}
          style={{background: 'transparent', border: 'none', padding: 0, cursor: 'pointer'}}
        >
          <Creature
            mood={mood}
            severity={sev}
            size={SIZE}
            restColor={colors.cardAlt}
            eyeColor={colors.textPrimary}
          />
        </PressableScale>
      </div>
    </div>
    </>
  );
}
