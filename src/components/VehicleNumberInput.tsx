import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '../context/ThemeContext';
import {Icon} from './Icon';
import {PressableScale} from './PressableScale';
import {visitorsApi} from '../services/api';
import {statesStartingWith, rtosStartingWith} from '../data/indianRto';
import {
  formatPlate, normalisePlate, parsePlate, validatePlate, isCompletePlate, MAX_PLATE_CHARS,
} from '../utils/plate';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Shown once the field has been touched, so a fresh form isn't red. */
  touched?: boolean;
  onTouch?: () => void;
  label?: string;
  required?: boolean;
}

// Plates already seen, keyed by the normalised query that fetched them. A
// valet checking in a queue of cars types the same state+RTO prefix over and
// over; without this each one is a fresh round trip for an answer we already
// had. Bounded so a long shift can't grow it without limit.
const historyCache = new Map<string, string[]>();
const CACHE_MAX = 40;

function cacheGet(key: string): string[] | undefined {
  return historyCache.get(key);
}
function cacheSet(key: string, value: string[]) {
  if (historyCache.size >= CACHE_MAX) {
    historyCache.delete(historyCache.keys().next().value as string);
  }
  historyCache.set(key, value);
}

/**
 * Indian vehicle number input with local autocomplete. DOM port of the
 * mobile app's identically-named component — same two-source suggestion
 * logic (real plates outrank the bundled state/RTO shape dataset).
 *
 * Suggestions come from two places and are never mixed up:
 *
 *   1. Vehicles already in our database — real cars, ranked by the backend on
 *      how recently and how often they've been here. These are FACTS.
 *   2. The bundled state/RTO dataset — what could exist. These are shapes.
 *
 * Facts always outrank shapes, because a plate we've parked before is a
 * better guess than one we've merely constructed. The dataset works with no
 * network at all, which is the point: the desk has to keep working offline.
 */
export function VehicleNumberInput({
  value, onChange, touched, onTouch, label = 'Vehicle Number', required,
}: Props) {
  const {colors} = useTheme();
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const raw = normalisePlate(value);
  const parts = parsePlate(value);
  const issue = validatePlate(value);
  const complete = issue === null;

  // ── previously parked vehicles ────────────────────────────────────────
  useEffect(() => {
    // Below four characters a prefix matches most of the car park, so the
    // dataset alone is more useful than a huge list of real plates.
    if (raw.length < 4) { setHistory([]); return; }

    const cached = cacheGet(raw);
    if (cached) { setHistory(cached); return; }

    let cancelled = false;
    // Debounced rather than per-keystroke: a plate is 10 characters, so
    // without this one entry is ten queries.
    const id = setTimeout(() => {
      visitorsApi.suggestPlates(raw)
        .then(list => {
          if (cancelled) return;
          cacheSet(raw, list);
          setHistory(list);
        })
        .catch(() => { /* dataset suggestions still stand */ });
    }, 250);
    return () => { cancelled = true; clearTimeout(id); };
  }, [raw]);

  // ── what to offer ─────────────────────────────────────────────────────
  const suggestions = useMemo(() => {
    const out: {text: string; kind: 'history' | 'dataset'; sub?: string}[] = [];
    const seen = new Set<string>();
    const push = (text: string, kind: 'history' | 'dataset', sub?: string) => {
      const key = normalisePlate(text);
      if (!key || seen.has(key) || key === raw) return;
      seen.add(key);
      out.push({text, kind, sub});
    };

    // 1. Real cars first, in the order the backend ranked them.
    for (const h of history) push(formatPlate(h), 'history', 'Parked before');

    if (parts) {
      // 2. State codes, while they're still typing letters.
      if (parts.state.length < 2 && !parts.rto) {
        for (const st of statesStartingWith(parts.state).slice(0, 6)) {
          push(st.code, 'dataset', st.name);
        }
      }
      // 3. RTO numbers for a known state.
      if (parts.state.length === 2 && !parts.series && parts.rto.length < 2) {
        for (const rto of rtosStartingWith(parts.state, parts.rto, 6)) {
          push(`${parts.state} ${rto}`, 'dataset');
        }
      }
    }

    // 4. Whatever they typed, correctly spaced — the one suggestion that is
    //    always available, including on a system with no history at all.
    const tidy = formatPlate(value);
    if (tidy && tidy !== value.toUpperCase()) push(tidy, 'dataset', 'Formatted');

    return out.slice(0, 10);
  }, [history, parts, raw, value]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  // Visibility is NOT tied directly to focus. Clicking a suggestion blurs the
  // input, and unmounting the list on blur pulled it out from under the
  // pointer before the click could land — the tap simply did nothing. So blur
  // schedules the close, and choosing a suggestion cancels that timer.
  const [listOpen, setListOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setListOpen(false), 200);
  };
  useEffect(() => cancelClose, []);

  const showList = listOpen && suggestions.length > 0;
  const showError = !!touched && !!issue && raw.length > 0;

  const accept = (text: string) => {
    cancelClose();
    const next = formatPlate(text);
    onChange(next);
    onTouch?.();
    // A state or RTO pick is a step, not an answer — keep the keyboard up so
    // they carry straight on. Once the plate is complete there is nothing
    // left to choose, so the list closes.
    if (isCompletePlate(next)) {
      setListOpen(false);
      inputRef.current?.blur();
    } else {
      setListOpen(true);
      inputRef.current?.focus();
    }
  };

  return (
    <div style={{marginBottom: 4}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <span style={{fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 4, color: colors.textMuted}}>{label.toUpperCase()}</span>
        {required && <span style={{fontSize: 9, fontWeight: 900, letterSpacing: 0.8, marginBottom: 8, marginTop: 4, color: colors.error}}>REQUIRED</span>}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', borderRadius: 14, paddingLeft: 10, paddingRight: 10, height: 58, marginBottom: 16,
        border: `1.5px solid ${showError ? colors.error : focused ? colors.textPrimary : colors.border}`,
        backgroundColor: colors.surface,
      }}>
        <div style={{width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0, backgroundColor: colors.cardAlt}}>
          <Icon name="car" size={16} color={showError ? colors.error : focused ? colors.textPrimary : colors.textMuted} />
        </div>
        <input
          ref={inputRef}
          style={{flex: 1, minWidth: 0, fontSize: 16, fontWeight: 800, letterSpacing: 1, fontVariantNumeric: 'tabular-nums', border: 'none', outline: 'none', background: 'transparent', color: colors.textPrimary}}
          value={value}
          onChange={e => {
            // Reformat on every keystroke so the spacing appears as they go.
            // Capped at the longest a real plate can be, which also stops a
            // pasted paragraph turning into nonsense.
            onChange(formatPlate(normalisePlate(e.target.value).slice(0, MAX_PLATE_CHARS)));
            cancelClose();
            setListOpen(true);
          }}
          onFocus={() => { setFocused(true); cancelClose(); setListOpen(true); }}
          onBlur={() => { setFocused(false); onTouch?.(); scheduleClose(); }}
          placeholder="AP 39 AB 1234"
          autoCapitalize="characters"
          autoCorrect="off"
        />
        {complete && <Icon name="check" size={16} color={colors.success} />}
      </div>

      {showError && <div style={{fontSize: 12, fontWeight: 700, marginTop: -12, marginBottom: 12, marginLeft: 2, color: colors.error}}>{issue!.message}</div>}

      {showList && (
        <div style={{border: `1px solid ${colors.border}`, borderRadius: 14, overflow: 'hidden', marginTop: -8, marginBottom: 14, backgroundColor: colors.surface}}>
          {suggestions.map((sug, i) => (
            <PressableScale
              key={sug.text}
              // onMouseDown, not just onClick: the pointer landing is the
              // earliest signal that a choice is being made, and it beats the
              // blur that would otherwise start the close timer. onClick
              // alone left a window where a slow click closed the list
              // mid-press.
              onMouseDown={cancelClose}
              onClick={() => accept(sug.text)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', textAlign: 'left',
                borderBottom: i === suggestions.length - 1 ? 'none' : `1px solid ${colors.divider ?? colors.border}`,
              }}>
              <Icon
                name={sug.kind === 'history' ? 'car' : 'search'}
                size={14}
                color={sug.kind === 'history' ? colors.primary : colors.textMuted}
              />
              <span style={{flex: 1, fontSize: 15, fontWeight: 800, letterSpacing: 0.5, fontVariantNumeric: 'tabular-nums', color: colors.textPrimary}}>{sug.text}</span>
              {!!sug.sub && <span style={{fontSize: 11, fontWeight: 700, color: colors.textMuted}}>{sug.sub}</span>}
            </PressableScale>
          ))}
        </div>
      )}
    </div>
  );
}
