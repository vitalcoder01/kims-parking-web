import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '../../context/ThemeContext';
import {useAppState, useDriverLocations} from '../../context/AppStateContext';
import {Icon} from '../../components/Icon';
import {PressableScale} from '../../components/PressableScale';

// Leaflet multi-driver map rendered inside an iframe via CARTO CDN tiles.
// Receives marker coordinates, bounds fitting, and driver focus commands
// via postMessage without ever reloading the map instance.
function buildMultiMapHTML(isDark: boolean) {
  const bgColor = isDark ? '#0B0F19' : '#F1F5F9';
  const tileStyle = isDark ? 'dark_all' : 'light_all';
  const popupBg = isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)';
  const popupText = isDark ? '#F8FAFC' : '#0F172A';
  const popupBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; background: ${bgColor}; overflow: hidden; }
  .leaflet-control-attribution { font-size: 9px !important; opacity: 0.55; background: transparent !important; }
  
  @keyframes radarPulse {
    0% { transform: scale(0.85); opacity: 0.85; }
    50% { transform: scale(1.65); opacity: 0; }
    100% { transform: scale(0.85); opacity: 0; }
  }

  .leaflet-popup-content-wrapper {
    background: ${popupBg} !important;
    color: ${popupText} !important;
    border: 1px solid ${popupBorder} !important;
    border-radius: 12px !important;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    padding: 2px 4px !important;
  }
  .leaflet-popup-tip {
    background: ${popupBg} !important;
  }
  .leaflet-popup-content {
    margin: 8px 12px !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-size: 12px !important;
    line-height: 1.4 !important;
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', {zoomControl: false, attributionControl: true}).setView([20.5937, 78.9629], 5);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/${tileStyle}/{z}/{x}/{y}{r}.png', {
    maxZoom: 20, subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);

  var markers = {};
  var cachedDrivers = [];

  function markerIcon(onJob) {
    var baseColor = onJob ? '#F59E0B' : '#10B981';
    var halo = onJob 
      ? '<div style="position:absolute;top:-5px;left:-5px;width:28px;height:28px;border-radius:14px;background:rgba(245,158,11,0.4);animation:radarPulse 2s infinite ease-out;"></div>' 
      : '';
    return L.divIcon({
      className: '',
      html: '<div style="position:relative;width:18px;height:18px;">' + halo + '<div style="position:relative;width:18px;height:18px;border-radius:9px;background:' + baseColor + ';border:2.5px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -10]
    });
  }

  function formatPopupContent(d) {
    var statusColor = d.onJob ? '#F59E0B' : '#10B981';
    var statusText = d.onJob ? 'ON MISSION' : 'READY / STANDBY';
    return '<div style="display:flex;flex-direction:column;gap:3px;">' +
      '<div style="display:flex;align-items:center;gap:6px;">' +
        '<span style="width:7px;height:7px;border-radius:50%;background:' + statusColor + ';"></span>' +
        '<span style="font-size:9.5px;font-weight:800;letter-spacing:0.5px;color:' + statusColor + ';">' + statusText + '</span>' +
      '</div>' +
      '<div style="font-size:13px;font-weight:800;">' + d.name + '</div>' +
      '<div style="font-size:11.5px;font-weight:600;opacity:0.85;">' + d.job + '</div>' +
    '</div>';
  }

  function updateMarkers(drivers, shouldFit) {
    cachedDrivers = drivers;
    var seen = {};
    drivers.forEach(function(d) {
      seen[d.id] = true;
      var latlng = [d.lat, d.lng];
      var popupHtml = formatPopupContent(d);
      if (markers[d.id]) {
        markers[d.id].setLatLng(latlng);
        markers[d.id].setIcon(markerIcon(d.onJob));
        markers[d.id].setPopupContent(popupHtml);
      } else {
        markers[d.id] = L.marker(latlng, {icon: markerIcon(d.onJob)})
          .addTo(map)
          .bindPopup(popupHtml);
      }
    });
    Object.keys(markers).forEach(function(id) {
      if (!seen[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
      }
    });
    if (shouldFit && drivers.length > 0) {
      var bounds = L.latLngBounds(drivers.map(function(d) { return [d.lat, d.lng]; }));
      map.fitBounds(bounds, {padding: [50, 50], maxZoom: 18});
    }
  }

  function fitAllBounds() {
    if (cachedDrivers.length > 0) {
      var bounds = L.latLngBounds(cachedDrivers.map(function(d) { return [d.lat, d.lng]; }));
      map.fitBounds(bounds, {padding: [50, 50], maxZoom: 18, animate: true});
    }
  }

  function focusDriver(id, lat, lng) {
    map.setView([lat, lng], 18, {animate: true});
    if (markers[id]) {
      markers[id].openPopup();
    }
  }

  window.addEventListener('message', function(e) {
    try {
      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data.type === 'updateMarkers') {
        updateMarkers(data.drivers, data.shouldFit);
      } else if (data.type === 'fitBounds') {
        fitAllBounds();
      } else if (data.type === 'focusDriver') {
        focusDriver(data.id, data.lat, data.lng);
      }
    } catch(err) {}
  });
</script>
</body>
</html>`;
}

export function ValetMapScreen() {
  const {colors, isDark} = useTheme();
  const {drivers, tasks} = useAppState();
  const {driverLocations, onlineDriverIds} = useDriverLocations();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const fittedOnce = useRef(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | number | null>(null);

  // Live positions stream in over socket (driver:location) for every connected
  // driver. Presence removes a driver the moment their app disconnects.
  const liveDrivers = useMemo(() => {
    return Object.values(driverLocations)
      .filter(loc => onlineDriverIds.includes(loc.driverId))
      .map(loc => {
        const activeTask = tasks.find(t => t.driverId === loc.driverId && t.status !== 'completed' && t.status !== 'requested');
        const driverObj = drivers.find(d => d.id === loc.driverId);
        return {
          id: loc.driverId,
          name: loc.name ?? driverObj?.name ?? 'Driver',
          lat: loc.lat,
          lng: loc.lng,
          job: activeTask
            ? `${activeTask.type === 'park' ? 'Parking' : 'Retrieving'} ${activeTask.carNumber}${activeTask.slotId ? ` · ${activeTask.slotId}` : ''}`
            : 'Idle · on shift',
          onJob: !!activeTask,
          activeTask,
        };
      });
  }, [driverLocations, onlineDriverIds, tasks, drivers]);

  const mapHTML = useMemo(() => buildMultiMapHTML(isDark), [isDark]);

  const sendMarkers = () => {
    const shouldFit = !fittedOnce.current && liveDrivers.length > 0;
    if (shouldFit) fittedOnce.current = true;
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({type: 'updateMarkers', drivers: liveDrivers, shouldFit}), '*',
    );
  };

  useEffect(() => {
    sendMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveDrivers]);

  const busyDrivers = drivers.filter(d => d.status === 'busy');
  const awaitingSignal = busyDrivers.filter(d => !liveDrivers.some(ld => ld.id === d.id));

  // Segment live drivers by operational mission state
  const activeMissions = liveDrivers.filter(d => d.onJob);
  const standbyRunners = liveDrivers.filter(d => !d.onJob);

  const handleFitBounds = () => {
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({type: 'fitBounds'}), '*',
    );
  };

  const handleFocusDriver = (d: typeof liveDrivers[0]) => {
    setSelectedDriverId(d.id);
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({type: 'focusDriver', id: d.id, lat: d.lat, lng: d.lng}), '*',
    );
  };

  return (
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: colors.background, minHeight: 0}}>
      {/* Restrained Glassy Workstation Header */}
      <div style={{
        padding: '14px 18px',
        backgroundColor: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        gap: 12,
      }}>
        <div style={{minWidth: 0}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span style={{fontSize: 16, fontWeight: 900, color: colors.textPrimary, letterSpacing: -0.2}}>
              Valet Fleet Radar
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 6,
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
              color: colors.primary,
              letterSpacing: 0.4,
            }}>
              KIMS MAIN CAMPUS
            </span>
          </div>
          <div style={{fontSize: 11.5, fontWeight: 600, color: colors.textSecondary, marginTop: 2}}>
            Live GPS telemetry & runner dispatch
          </div>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0}}>
          {/* Live Online Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 20,
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
            border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.25)' : '#A7F3D0'}`,
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: colors.success,
              boxShadow: `0 0 8px ${colors.success}`,
            }} />
            <span style={{fontSize: 11, fontWeight: 800, color: colors.success, fontVariantNumeric: 'tabular-nums'}}>
              {liveDrivers.length} ONLINE
            </span>
          </div>

          {/* Re-center / Fit bounds trigger */}
          <PressableScale
            onClick={handleFitBounds}
            disabled={liveDrivers.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 11px',
              borderRadius: 10,
              backgroundColor: colors.cardAlt,
              border: `1px solid ${colors.border}`,
              cursor: liveDrivers.length > 0 ? 'pointer' : 'default',
              opacity: liveDrivers.length > 0 ? 1 : 0.4,
            }}>
            <Icon name="navigate" size={13} color={colors.textPrimary} />
            <span style={{fontSize: 11, fontWeight: 700, color: colors.textPrimary}}>Fit Fleet</span>
          </PressableScale>
        </div>
      </div>

      <div className="screen-scroll" style={{padding: 16, paddingBottom: 40}}>
        {/* Leaflet + CARTO Basemap Radar Viewport */}
        <div style={{
          position: 'relative',
          height: 340,
          borderRadius: 18,
          border: `1px solid ${colors.border}`,
          overflow: 'hidden',
          marginBottom: 18,
          backgroundColor: isDark ? '#0B0F19' : '#F1F5F9',
          boxShadow: isDark ? '0 8px 24px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(0, 0, 0, 0.05)',
        }}>
          <iframe
            ref={frameRef}
            title="Live driver map"
            srcDoc={mapHTML}
            onLoad={sendMarkers}
            style={{border: 'none', width: '100%', height: '100%', display: 'block'}}
          />

          {/* Live Overlay Pill */}
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            borderRadius: 20,
            padding: '4px 10px',
            backgroundColor: 'rgba(239, 68, 68, 0.9)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
          }}>
            <span style={{width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff'}} />
            <span style={{color: '#fff', fontSize: 10, fontWeight: 900, letterSpacing: 1}}>LIVE RADAR</span>
          </div>

          {/* Bottom Left Map Legend */}
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '5px 12px',
            borderRadius: 10,
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
            backdropFilter: 'blur(8px)',
          }}>
            <div style={{display: 'flex', alignItems: 'center', gap: 5}}>
              <span style={{width: 7, height: 7, borderRadius: 4, backgroundColor: '#F59E0B'}} />
              <span style={{fontSize: 10.5, fontWeight: 700, color: colors.textSecondary}}>On Mission ({activeMissions.length})</span>
            </div>
            <div style={{width: 1, height: 12, backgroundColor: colors.border}} />
            <div style={{display: 'flex', alignItems: 'center', gap: 5}}>
              <span style={{width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981'}} />
              <span style={{fontSize: 10.5, fontWeight: 700, color: colors.textSecondary}}>Ready ({standbyRunners.length})</span>
            </div>
          </div>
        </div>

        {/* Empty Fleet State */}
        {liveDrivers.length === 0 && awaitingSignal.length === 0 && (
          <div style={{
            borderRadius: 16,
            border: `1px dashed ${colors.border}`,
            padding: '36px 20px',
            textAlign: 'center',
            backgroundColor: colors.surface,
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.cardAlt,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <Icon name="navigate" size={24} color={colors.textMuted} />
            </div>
            <div style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary, marginBottom: 4}}>
              No Runners Reachable
            </div>
            <div style={{fontSize: 12, fontWeight: 600, color: colors.textSecondary, lineHeight: '18px', maxWidth: 300, margin: '0 auto'}}>
              Runner positions stream automatically the moment their app connects and shares GPS telemetry.
            </div>
          </div>
        )}

        {/* 1. Active Missions Section */}
        {activeMissions.length > 0 && (
          <div style={{marginBottom: 20}}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                <span style={{width: 7, height: 7, borderRadius: 4, backgroundColor: '#F59E0B'}} />
                <span style={{fontSize: 13, fontWeight: 800, color: colors.textPrimary, letterSpacing: -0.1}}>
                  Active Missions ({activeMissions.length})
                </span>
              </div>
              <span style={{fontSize: 11, fontWeight: 600, color: colors.textMuted}}>
                Tap to center radar
              </span>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
              {activeMissions.map(d => {
                const isSelected = selectedDriverId === d.id;
                const isPark = d.activeTask?.type === 'park';
                return (
                  <PressableScale
                    key={d.id}
                    onClick={() => handleFocusDriver(d)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      borderRadius: 14,
                      border: `1px solid ${isSelected ? colors.primary : colors.border}`,
                      padding: 12,
                      backgroundColor: isSelected ? (isDark ? 'rgba(59, 130, 246, 0.08)' : '#F0F9FF') : colors.surface,
                      transition: 'all 0.15s ease',
                      cursor: 'pointer',
                    }}>
                    {/* Runner Avatar */}
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#F59E0B',
                      flexShrink: 0,
                      position: 'relative',
                    }}>
                      <span style={{fontSize: 14, fontWeight: 900, color: '#1E293B'}}>
                        {d.name[0]}
                      </span>
                      <span style={{
                        position: 'absolute',
                        bottom: -1,
                        right: -1,
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: '#F59E0B',
                        border: `2px solid ${colors.surface}`,
                      }} />
                    </div>

                    {/* Driver & Task Details */}
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                        <span style={{fontSize: 13.5, fontWeight: 800, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                          {d.name}
                        </span>
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: isPark ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5') : (isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB'),
                          color: isPark ? colors.success : '#D97706',
                          letterSpacing: 0.3,
                        }}>
                          {isPark ? 'PARKING' : 'RETRIEVING'}
                        </span>
                      </div>

                      <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 4}}>
                        {d.activeTask?.carNumber && (
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: 11.5,
                            fontWeight: 800,
                            color: colors.textPrimary,
                            backgroundColor: colors.cardAlt,
                            padding: '1px 6px',
                            borderRadius: 4,
                            letterSpacing: 0.5,
                          }}>
                            {d.activeTask.carNumber}
                          </span>
                        )}
                        {d.activeTask?.slotId && (
                          <span style={{fontSize: 11, fontWeight: 700, color: colors.textSecondary}}>
                            {d.activeTask.slotId}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Direct Locate Target Button */}
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: colors.cardAlt,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon name="navigate" size={14} color={isSelected ? colors.primary : colors.textMuted} />
                    </div>
                  </PressableScale>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Standby / Available Runners Section */}
        {standbyRunners.length > 0 && (
          <div style={{marginBottom: 20}}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                <span style={{width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981'}} />
                <span style={{fontSize: 13, fontWeight: 800, color: colors.textPrimary, letterSpacing: -0.1}}>
                  Ready for Dispatch ({standbyRunners.length})
                </span>
              </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
              {standbyRunners.map(d => {
                const isSelected = selectedDriverId === d.id;
                return (
                  <PressableScale
                    key={d.id}
                    onClick={() => handleFocusDriver(d)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      borderRadius: 14,
                      border: `1px solid ${isSelected ? colors.primary : colors.border}`,
                      padding: 12,
                      backgroundColor: isSelected ? (isDark ? 'rgba(59, 130, 246, 0.08)' : '#F0F9FF') : colors.surface,
                      transition: 'all 0.15s ease',
                      cursor: 'pointer',
                    }}>
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.cardAlt,
                      flexShrink: 0,
                      position: 'relative',
                    }}>
                      <span style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>
                        {d.name[0]}
                      </span>
                      <span style={{
                        position: 'absolute',
                        bottom: -1,
                        right: -1,
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: '#10B981',
                        border: `2px solid ${colors.surface}`,
                      }} />
                    </div>

                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={{fontSize: 13.5, fontWeight: 800, color: colors.textPrimary}}>
                        {d.name}
                      </div>
                      <div style={{fontSize: 11.5, fontWeight: 600, color: colors.success, marginTop: 2}}>
                        Available · Ready for next assignment
                      </div>
                    </div>

                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: colors.cardAlt,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon name="navigate" size={14} color={isSelected ? colors.primary : colors.textMuted} />
                    </div>
                  </PressableScale>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Awaiting GPS Signal (Busy assigned runners with offline GPS) */}
        {awaitingSignal.length > 0 && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 10,
            }}>
              <Icon name="alert" size={14} color={colors.warning} />
              <span style={{fontSize: 13, fontWeight: 800, color: colors.textPrimary, letterSpacing: -0.1}}>
                Awaiting GPS Telemetry ({awaitingSignal.length})
              </span>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
              {awaitingSignal.map(d => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: 14,
                    border: `1px solid ${colors.border}`,
                    padding: 12,
                    backgroundColor: colors.surface,
                  }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.cardAlt,
                    flexShrink: 0,
                    position: 'relative',
                  }}>
                    <span style={{fontSize: 14, fontWeight: 800, color: colors.textSecondary}}>
                      {d.name[0]}
                    </span>
                    <span style={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: colors.warning,
                      border: `2px solid ${colors.surface}`,
                    }} />
                  </div>

                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={{fontSize: 13.5, fontWeight: 800, color: colors.textPrimary}}>
                      {d.name}
                    </div>
                    <div style={{fontSize: 11.5, fontWeight: 600, color: colors.textMuted, marginTop: 2}}>
                      On task · Waiting for mobile phone GPS check-in
                    </div>
                  </div>

                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 6,
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB',
                    color: colors.warning,
                    letterSpacing: 0.3,
                  }}>
                    SIGNAL PENDING
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
