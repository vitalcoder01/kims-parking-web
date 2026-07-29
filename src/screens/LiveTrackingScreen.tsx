import React, {useEffect, useRef, useState} from 'react';
import {PressableScale} from '../components/PressableScale';
import {useTheme} from '../context/ThemeContext';
import {ParkingTask} from '../context/AppStateContext';
import {computeTrip} from '../utils/geo';
import {Icon} from '../components/Icon';

// Same Leaflet/OSM map HTML the mobile app renders in a WebView — here it
// lives in an iframe (srcDoc) and receives real GPS fixes via postMessage.
function buildMapHTML(
  centerLat: number, centerLng: number,
  destLat: number | null, destLng: number | null,
  isDark: boolean,
) {
  const bgColor = isDark ? '#0F1829' : '#EEF2FF';

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; background: ${bgColor}; }
  .leaflet-tile-pane { ${isDark ? 'filter: brightness(0.7) saturate(0.8) hue-rotate(190deg);' : ''} }
  .car-icon { font-size: 28px; line-height: 1; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4)); }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', {zoomControl: false, attributionControl: false}).setView([${centerLat}, ${centerLng}], 17);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19}).addTo(map);

  var destination = ${destLat != null && destLng != null ? `[${destLat}, ${destLng}]` : 'null'};
  var routeLine = null;

  if (destination) {
    L.circleMarker(destination, {
      radius: 10, color: '${isDark ? '#F59E0B' : '#D97706'}',
      fillColor: '${isDark ? '#F59E0B' : '#D97706'}', fillOpacity: 1, weight: 3,
    }).addTo(map).bindPopup('<b>Destination</b>');
  }

  var carIcon = L.divIcon({className: '', html: '<div class="car-icon">🚗</div>', iconSize: [32, 32], iconAnchor: [16, 16]});
  var carMarker = L.marker([${centerLat}, ${centerLng}], {icon: carIcon}).addTo(map);

  function refreshRoute(pos) {
    if (!destination) return;
    if (routeLine) map.removeLayer(routeLine);
    routeLine = L.polyline([pos, destination], {
      color: '${isDark ? '#818CF8' : '#4F46E5'}', weight: 4, opacity: 0.75, dashArray: '8, 6', lineCap: 'round',
    }).addTo(map);
  }
  refreshRoute([${centerLat}, ${centerLng}]);

  window.addEventListener('message', function(e) {
    try {
      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data.type === 'realGPS') {
        var pos = [data.lat, data.lng];
        carMarker.setLatLng(pos);
        map.panTo(pos, {animate: true, duration: 1.0});
        refreshRoute(pos);
      }
    } catch(err) {}
  });
</script>
</body>
</html>`;
}

interface Props {
  task?: ParkingTask;
  onBack?: () => void;
}

export function LiveTrackingScreen({task, onBack}: Props) {
  const {colors, isDark} = useTheme();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [trip, setTrip] = useState<{progress: number; etaMinutes: number; distanceRemainingM: number | null} | null>(null);

  // 'delivered' (retrieve trips only) already means the car physically
  // arrived at the valet counter — the trip visually "arrives" there.
  const arrived = task?.status === 'completed' || task?.status === 'delivered';
  const realLat = task?.driverLat ?? null;
  const realLng = task?.driverLng ?? null;

  useEffect(() => {
    if (realLat == null || realLng == null) return;
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({type: 'realGPS', lat: realLat, lng: realLng}), '*');

    const result = computeTrip({
      startLat: task?.driverStartLat, startLng: task?.driverStartLng,
      lat: realLat, lng: realLng,
      destinationLat: task?.destinationLat, destinationLng: task?.destinationLng,
      mode: 'drive',
    });
    if (!result) return;
    setTrip(result);
  }, [realLat, realLng, task?.driverStartLat, task?.driverStartLng, task?.destinationLat, task?.destinationLng, task?.type]);

  const progress = trip?.progress ?? 0;

  if (!task) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 40, gap: 8, backgroundColor: colors.background,
      }}>
        <Icon name="parking" size={40} color={colors.textMuted} style={{marginBottom: 8}} />
        <div style={{fontSize: 18, fontWeight: 800, color: colors.textPrimary}}>No Active Task</div>
        <div style={{fontSize: 13, textAlign: 'center', lineHeight: '19px', color: colors.textMuted}}>
          Live tracking will appear here once you have an assigned task.
        </div>
      </div>
    );
  }

  // Center on whatever real position is actually known — never a fixed demo
  // coordinate.
  const centerLat = realLat ?? task.destinationLat ?? 20.5937;
  const centerLng = realLng ?? task.destinationLng ?? 78.9629;
  const mapHTML = buildMapHTML(centerLat, centerLng, task.destinationLat ?? null, task.destinationLng ?? null, isDark);

  return (
    <div style={{flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', backgroundColor: colors.background, minHeight: 0}}>
      {/* Back button overlay */}
      {onBack && (
        <PressableScale
          onClick={onBack}
          style={{
            position: 'absolute', top: 16, left: 16, zIndex: 10, width: 42, height: 42, borderRadius: 21,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.surface, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}>
          <Icon name="back" size={20} color={colors.textPrimary} />
        </PressableScale>
      )}

      {!arrived && (
        <div style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: 5,
          borderRadius: 20, padding: '6px 12px', backgroundColor: colors.error,
        }}>
          <span style={{width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff'}} />
          <span style={{color: '#fff', fontSize: 11, fontWeight: 900, letterSpacing: 1}}>LIVE</span>
        </div>
      )}

      {realLat != null && (
        <div style={{
          position: 'absolute', top: 64, right: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: 5,
          borderRadius: 12, padding: '5px 10px', backgroundColor: colors.success,
        }}>
          <Icon name="live" size={12} color="#fff" />
          <span style={{color: '#fff', fontSize: 10, fontWeight: 700}}>Live GPS</span>
        </div>
      )}

      {/* Map */}
      <iframe
        ref={frameRef}
        title="Live tracking map"
        srcDoc={mapHTML}
        style={{flex: 1, border: 'none', width: '100%', minHeight: 0}}
      />

      {/* Bottom info sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: '8px 20px 32px', backgroundColor: colors.surface,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
      }}>
        {/* Progress bar */}
        <div style={{height: 4, borderRadius: 2, margin: '16px 0', overflow: 'hidden', backgroundColor: colors.border}}>
          <div style={{
            height: '100%', borderRadius: 2, width: `${Math.round(progress * 100)}%`,
            backgroundColor: arrived ? colors.success : colors.primary,
            transition: 'width 0.4s ease',
          }} />
        </div>

        {arrived ? (
          <div style={{display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0'}}>
            <div style={{
              width: 52, height: 52, borderRadius: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.successLight,
            }}>
              <Icon name="check" size={24} color={colors.success} />
            </div>
            <div>
              <div style={{fontSize: 17, fontWeight: 800, color: colors.success}}>
                {task.type === 'park'
                  ? 'Car Parked Successfully!'
                  : task.status === 'delivered'
                  ? 'Car Has Arrived!'
                  : 'Car Retrieved!'}
              </div>
              <div style={{fontSize: 12, marginTop: 4, color: colors.textMuted}}>
                {task.type === 'retrieve'
                  ? (task.status === 'delivered' ? 'Please collect it at the entrance' : 'Delivered to you')
                  : task.slotId ? `Slot: ${task.slotId}` : 'Delivered to valet counter'}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
              <div>
                <div style={{fontSize: 17, fontWeight: 800, color: colors.textPrimary}}>
                  {task.type === 'park' ? 'Parking your car' : 'Retrieving your car'}
                </div>
                <div style={{fontSize: 12, marginTop: 3, color: colors.textMuted}}>
                  {task.carNumber ?? 'Vehicle'} · {task.driverName ?? 'Driver en route'}
                </div>
              </div>
              {trip ? (
                <div style={{
                  borderRadius: 14, padding: '10px 14px', textAlign: 'center', backgroundColor: colors.primary,
                }}>
                  <div style={{color: colors.textOnPrimary, fontSize: 22, fontWeight: 900}}>{trip.etaMinutes}</div>
                  <div style={{color: colors.textOnPrimary, fontSize: 10, fontWeight: 700}}>min</div>
                </div>
              ) : (
                <div style={{borderRadius: 14, padding: '10px 14px', textAlign: 'center', backgroundColor: colors.textMuted}}>
                  <div style={{color: '#fff', fontSize: 10, fontWeight: 700, whiteSpace: 'pre-line'}}>{'Waiting\nfor GPS'}</div>
                </div>
              )}
            </div>

            {trip?.distanceRemainingM != null && (
              <div style={{fontSize: 11, fontWeight: 600, marginBottom: 12, color: colors.textMuted}}>
                {trip.distanceRemainingM < 1000 ? `${trip.distanceRemainingM} m` : `${(trip.distanceRemainingM / 1000).toFixed(1)} km`} remaining
              </div>
            )}

            <div style={{display: 'flex', alignItems: 'flex-start', margin: '8px 0 16px'}}>
              {['Key Collected', 'In Transit', task.type === 'park' ? 'Parked' : 'Delivered'].map((step, i) => {
                const done = progress > i * 0.4;
                return (
                  <div key={step} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative'}}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 14, marginBottom: 6, zIndex: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: done ? colors.success : colors.border,
                    }}>
                      {done && <Icon name="checkBold" size={12} color="#fff" />}
                    </div>
                    <div style={{fontSize: 10, fontWeight: 700, textAlign: 'center', color: done ? colors.textPrimary : colors.textMuted}}>{step}</div>
                    {i < 2 && (
                      <div style={{
                        position: 'absolute', top: 14, left: '50%', width: '100%', height: 2,
                        backgroundColor: done ? colors.success : colors.border,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            {task.slotId && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                borderRadius: 12, border: `1px solid ${colors.primary}30`, padding: 12,
                backgroundColor: colors.primary + '12',
              }}>
                <Icon name={task.type === 'retrieve' ? 'pin' : 'parking'} size={14} color={colors.primary} />
                <span style={{fontSize: 13, fontWeight: 600, color: colors.primary}}>
                  {task.type === 'retrieve' ? 'Retrieving from' : 'Destination'}: <b style={{fontWeight: 900}}>{task.slotId}</b>
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
