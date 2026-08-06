import React, {useCallback, useEffect, useState} from 'react';
import {useTheme} from '../context/ThemeContext';
import {BRAND_GRADIENT, BRAND_GRADIENT_DARK, gradientCss} from '../theme/colors';
import {Icon} from '../components/Icon';
import {PressableScale} from '../components/PressableScale';
import {analyticsApi, AnalyticsOverview} from '../services/api';

// Shared by both the valet and admin tabs — the data isn't role-scoped (see
// backend analytics.service.js: it's the whole operation's all-time
// picture), so a valet reads it as "how is my shift going" and admin reads
// the identical screen as "how is the operation going". One screen, two
// doors in — mirrors mobile's screens/AnalyticsScreen.tsx exactly.

const MEDALS = ['#F5C168', '#C7CDD6', '#D3946B']; // gold / silver / bronze

function hourLabel(h: number | null): string {
  if (h == null) return '—';
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${period}`;
}

function minutesLabel(m: number | null): string {
  if (m == null) return '—';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
}

export function AnalyticsScreen() {
  const {colors, isDark} = useTheme();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback((silent?: boolean) => {
    if (!silent) setLoading(true);
    analyticsApi.overview()
      .then(d => { setData(d); setErr(null); })
      .catch(() => setErr('Could not load analytics'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const visitorTotal = (data?.visitorJobs ?? 0) + (data?.staffJobs ?? 0);
  const visitorPct = visitorTotal > 0 ? Math.round(((data?.visitorJobs ?? 0) / visitorTotal) * 100) : 0;
  const activeDrivers = (data?.drivers ?? []).filter(d => d.totalCompleted > 0);
  const idleDrivers = (data?.drivers ?? []).filter(d => d.totalCompleted === 0);

  const cardStyle: React.CSSProperties = {backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 16};
  const emptyBoxStyle: React.CSSProperties = {
    borderRadius: 16, border: `1px dashed ${colors.border}`, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: '32px 20px', textAlign: 'center',
  };

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background}}>
      <div style={{background: gradientCss(isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT), padding: '16px 20px 22px', borderBottomLeftRadius: 26, borderBottomRightRadius: 26}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20}}>
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4}}>
              <Icon name="sparkle" size={12} color="rgba(255,255,255,0.75)" />
              <span style={{color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 800, letterSpacing: 1.2}}>ALL-TIME</span>
            </div>
            <div style={{color: '#fff', fontSize: 24, fontWeight: 900}}>Analytics</div>
          </div>
          <PressableScale
            style={{width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}
            onClick={() => { setRefreshing(true); load(true); }}>
            <Icon name="refresh" size={18} color="#fff" />
          </PressableScale>
        </div>

        <div style={{display: 'flex', alignItems: 'center'}}>
          {[
            [data?.totalCarsParked ?? (loading ? '–' : 0), 'Parked'],
            [data?.totalCarsRetrieved ?? (loading ? '–' : 0), 'Retrieved'],
            [data?.totalJobsCompleted ?? (loading ? '–' : 0), 'Total Jobs'],
          ].map(([num, lbl], i) => (
            <React.Fragment key={lbl as string}>
              {i > 0 && <div style={{width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.2)'}} />}
              <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <span style={{color: '#fff', fontSize: 28, fontWeight: 900}}>{num}</span>
                <span style={{color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 700, marginTop: 2}}>{lbl}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 30px'}}>
          <div className="spinner" style={{width: 28, height: 28, borderColor: colors.primary}} />
        </div>
      ) : err && !data ? (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 30px'}}>
          <Icon name="alert" size={26} color={colors.textMuted} style={{marginBottom: 8}} />
          <span style={{color: colors.textMuted, marginBottom: 12}}>{err}</span>
          <PressableScale onClick={() => load()} style={{padding: '10px 20px', borderRadius: 12, backgroundColor: colors.primary}}>
            <span style={{color: colors.background, fontWeight: 800}}>Retry</span>
          </PressableScale>
        </div>
      ) : (
        <div style={{padding: '18px 20px 32px'}}>
          {/* Timing */}
          <div style={{display: 'flex', gap: 12, marginBottom: 14}}>
            <div style={{...cardStyle, flex: 1, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
              <div style={{width: 34, height: 34, borderRadius: 10, backgroundColor: colors.success + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10}}>
                <Icon name="carKey" size={18} color={colors.success} />
              </div>
              <span style={{fontSize: 18, fontWeight: 900, color: colors.textPrimary}}>{minutesLabel(data?.avgParkMinutes ?? null)}</span>
              <span style={{fontSize: 11, fontWeight: 700, marginTop: 2, color: colors.textMuted}}>Avg. park time</span>
            </div>
            <div style={{...cardStyle, flex: 1, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
              <div style={{width: 34, height: 34, borderRadius: 10, backgroundColor: colors.info + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10}}>
                <Icon name="route" size={18} color={colors.info} />
              </div>
              <span style={{fontSize: 18, fontWeight: 900, color: colors.textPrimary}}>{minutesLabel(data?.avgRetrieveMinutes ?? null)}</span>
              <span style={{fontSize: 11, fontWeight: 700, marginTop: 2, color: colors.textMuted}}>Avg. retrieve time</span>
            </div>
          </div>

          {/* Insights */}
          <div style={{...cardStyle, padding: 14, marginBottom: 22}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <div style={{width: 32, height: 32, borderRadius: 9, backgroundColor: '#F5C16818', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                <Icon name="clock" size={16} color="#F5C168" />
              </div>
              <div style={{flex: 1}}>
                <div style={{fontSize: 12, fontWeight: 700, color: colors.textMuted}}>Busiest hour</div>
                <div style={{fontSize: 16, fontWeight: 900, marginTop: 2, color: colors.textPrimary}}>{hourLabel(data?.busiestHour ?? null)}</div>
              </div>
            </div>
            <div style={{height: 1, margin: '12px 0', backgroundColor: colors.divider}} />
            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <div style={{width: 32, height: 32, borderRadius: 9, backgroundColor: colors.primary + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                <Icon name="people" size={16} color={colors.primary} />
              </div>
              <div style={{flex: 1}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
                  <span style={{fontSize: 12, fontWeight: 700, color: colors.textMuted}}>Visitor vs staff jobs</span>
                  <span style={{fontSize: 12, fontWeight: 800, color: colors.textMuted}}>{visitorPct}% visitor</span>
                </div>
                <div style={{height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.border}}>
                  <div style={{height: 6, borderRadius: 3, width: `${visitorPct}%`, backgroundColor: colors.primary}} />
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 4}}>
                  <span style={{fontSize: 10.5, fontWeight: 700, color: colors.textMuted}}>{data?.visitorJobs ?? 0} visitor</span>
                  <span style={{fontSize: 10.5, fontWeight: 700, color: colors.textMuted}}>{data?.staffJobs ?? 0} staff</span>
                </div>
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div style={{display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12}}>
            <Icon name="trophy" size={16} color="#F5C168" />
            <span style={{fontSize: 15, fontWeight: 900, color: colors.textPrimary}}>Top Performers</span>
          </div>

          {activeDrivers.length === 0 && idleDrivers.length === 0 ? (
            <div style={emptyBoxStyle}>
              <Icon name="trophy" size={26} color={colors.textMuted} style={{marginBottom: 8}} />
              <span style={{fontSize: 13, fontWeight: 600, color: colors.textMuted}}>No drivers yet</span>
            </div>
          ) : activeDrivers.length === 0 ? (
            <div style={emptyBoxStyle}>
              <Icon name="trophy" size={26} color={colors.textMuted} style={{marginBottom: 8}} />
              <span style={{fontSize: 13, fontWeight: 600, color: colors.textMuted}}>No completed jobs yet — the leaderboard fills in as drivers finish their first job.</span>
            </div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
              {activeDrivers.map((d, i) => {
                const medal = MEDALS[i] ?? null;
                return (
                  <div key={d.id} style={{
                    ...cardStyle, borderColor: medal ?? colors.border, borderWidth: medal ? 1.5 : 1,
                    display: 'flex', alignItems: 'center', gap: 12, padding: 14,
                  }}>
                    <div style={{width: 30, height: 30, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: medal ?? colors.border}}>
                      <span style={{fontSize: 13, fontWeight: 900, color: medal ? '#15161A' : colors.textMuted}}>{i + 1}</span>
                    </div>
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={{fontSize: 14.5, fontWeight: 800, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{d.name}</div>
                      <div style={{fontSize: 11.5, fontWeight: 600, marginTop: 2, color: colors.textMuted}}>
                        {d.parksCompleted} parked · {d.retrievesCompleted} retrieved
                      </div>
                      <div style={{fontSize: 11.5, fontWeight: 600, marginTop: 2, color: colors.textMuted}}>
                        {minutesLabel(d.avgParkMinutes)} avg park · {minutesLabel(d.avgRetrieveMinutes)} avg retrieve
                      </div>
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0}}>
                      <span style={{fontSize: 20, fontWeight: 900, color: colors.textPrimary}}>{d.totalCompleted}</span>
                      <span style={{fontSize: 10, fontWeight: 700, color: colors.textMuted}}>jobs</span>
                    </div>
                  </div>
                );
              })}
              {idleDrivers.length > 0 && (
                <span style={{fontSize: 11.5, fontWeight: 600, marginTop: 4, padding: '0 2px', color: colors.textMuted}}>
                  {idleDrivers.length} driver{idleDrivers.length > 1 ? 's' : ''} with no completed jobs yet — {idleDrivers.map(d => d.name.split(' ')[0]).join(', ')}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
