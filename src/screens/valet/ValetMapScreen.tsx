import React, {useEffect, useMemo, useRef} from 'react';
import {useTheme} from '../../context/ThemeContext';
import {useAppState, useDriverLocations} from '../../context/AppStateContext';
import {Icon} from '../../components/Icon';

// Same Leaflet multi-driver map the mobile app renders in a WebView (see
// leafletMapHtml.ts) — here it lives in an iframe (srcDoc) and receives
// marker updates via postMessage instead of RN's injectJavaScript, matching
// the pattern LiveTrackingScreen.tsx already established.
//
// Tiles come from CARTO's basemap CDN, not tile.openstreetmap.org directly —
// see LiveTrackingScreen.tsx's comment: OSM's raw tile servers rate-limit or
// block real app traffic under their usage policy, while CARTO's CDN is
// built for exactly this and serves the same OSM data, light and dark.
function buildMultiMapHTML(isDark: boolean) {
  const bgColor = isDark ? '#0F1829' : '#EEF2FF';
  const tileStyle = isDark ? 'dark_all' : 'light_all';

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; background: ${bgColor}; }
  .leaflet-control-attribution { font-size: 9px !important; opacity: 0.6; background: transparent !important; }
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

  function markerIcon(onJob) {
    var color = onJob ? '#E65100' : '#1B5E20';
    return L.divIcon({
      className: '',
      html: '<div style="width:16px;height:16px;border-radius:8px;background:' + color + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }

  function updateMarkers(drivers, shouldFit) {
    var seen = {};
    drivers.forEach(function(d) {
      seen[d.id] = true;
      var latlng = [d.lat, d.lng];
      if (markers[d.id]) {
        markers[d.id].setLatLng(latlng);
        markers[d.id].setIcon(markerIcon(d.onJob));
        markers[d.id].setPopupContent(d.name + ' — ' + d.job);
      } else {
        markers[d.id] = L.marker(latlng, {icon: markerIcon(d.onJob)})
          .addTo(map)
          .bindPopup(d.name + ' — ' + d.job);
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
      map.fitBounds(bounds, {padding: [50, 50]});
    }
  }

  window.addEventListener('message', function(e) {
    try {
      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data.type === 'updateMarkers') {
        updateMarkers(data.drivers, data.shouldFit);
      }
    } catch(err) {}
  });
</script>
</body>
</html>`;
}

// Direct port of the mobile app's ValetMapScreen. Used to also carry the
// slot occupancy grid as a "Parking Layout" sub-tab; that moved into the
// Jobs page (alongside Visitors/Staff, as another kind of record) so this
// screen is GPS-only now.
export function ValetMapScreen() {
  const {colors, isDark} = useTheme();
  const {drivers, tasks} = useAppState();
  // Separate context — a GPS ping re-renders this screen and nothing else.
  const {driverLocations, onlineDriverIds} = useDriverLocations();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const fittedOnce = useRef(false);

  // Live positions stream in over the socket (driver:location) for every
  // connected driver — idle or on a job. Presence removes a driver the
  // moment their app dies, so a marker on this map is always a phone that
  // is actually reachable right now.
  const liveDrivers = useMemo(() => {
    return Object.values(driverLocations)
      .filter(loc => onlineDriverIds.includes(loc.driverId))
      .map(loc => {
        const activeTask = tasks.find(t => t.driverId === loc.driverId && t.status !== 'completed' && t.status !== 'requested');
        return {
          id: loc.driverId,
          name: loc.name ?? drivers.find(d => d.id === loc.driverId)?.name ?? 'Driver',
          lat: loc.lat,
          lng: loc.lng,
          job: activeTask
            ? `${activeTask.type === 'park' ? 'Parking' : 'Retrieving'} ${activeTask.carNumber}${activeTask.slotId ? ` · ${activeTask.slotId}` : ''}`
            : 'Idle · on shift',
          onJob: !!activeTask,
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

  // Push updated marker positions into the Leaflet map on every socket
  // delta — the iframe keeps its own Leaflet map instance alive and just
  // repositions/adds/removes markers, it never reloads the page.
  useEffect(() => {
    sendMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveDrivers]);

  const busyDrivers = drivers.filter(d => d.status === 'busy');

  return (
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: colors.background, minHeight: 0}}>
      <div className="screen-scroll" style={{padding: 16, paddingBottom: 40}}>
        {/* Leaflet + CARTO tiles card — markers driven purely by socket
            deltas via postMessage (never a page reload) */}
        <div style={{
          position: 'relative', height: 320, borderRadius: 20, border: `1px solid ${colors.border}`, overflow: 'hidden', marginBottom: 20,
        }}>
          <iframe
            ref={frameRef}
            title="Live driver map"
            srcDoc={mapHTML}
            // Self-healing resync: whenever the document (re)loads, re-send
            // whatever markers are already known — closes the race where a
            // postMessage sent before the iframe's script has registered
            // its listener would otherwise be silently dropped.
            onLoad={sendMarkers}
            style={{border: 'none', width: '100%', height: '100%'}}
          />
          <div style={{position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', borderRadius: 20, padding: '5px 10px', backgroundColor: colors.error}}>
            <span style={{color: '#fff', fontSize: 10, fontWeight: 900, letterSpacing: 1}}>LIVE</span>
          </div>
        </div>

        {/* Drivers currently reachable */}
        <div style={{fontSize: 15, fontWeight: 800, marginBottom: 12, color: colors.textPrimary}}>On the map ({liveDrivers.length})</div>
        {liveDrivers.length === 0 ? (
          <div style={{borderRadius: 14, border: `1px dashed ${colors.border}`, padding: 24, textAlign: 'center'}}>
            <Icon name="navigate" size={26} color={colors.textMuted} style={{marginBottom: 8}} />
            <div style={{fontSize: 13, fontWeight: 600, textAlign: 'center', lineHeight: '19px', color: colors.textMuted}}>
              No drivers reachable right now.<br />They appear the moment their app connects and shares GPS.
            </div>
          </div>
        ) : liveDrivers.map(d => (
          <div key={d.id} style={{display: 'flex', alignItems: 'center', gap: 12, borderRadius: 16, border: `1px solid ${colors.border}`, padding: 14, marginBottom: 10, backgroundColor: colors.surface}}>
            <div style={{width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary}}>
              <span style={{fontSize: 16, fontWeight: 800, color: colors.textOnPrimary}}>{d.name[0]}</span>
            </div>
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>{d.name}</div>
              <div style={{fontSize: 12, fontWeight: 600, marginTop: 2, color: colors.textSecondary}}>{d.job}</div>
            </div>
            <span style={{width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success}} />
          </div>
        ))}

        {/* Busy but not on the map — assigned yet no GPS/socket reaching us */}
        {busyDrivers.filter(d => !liveDrivers.some(ld => ld.id === d.id)).map(d => (
          <div key={d.id} style={{display: 'flex', alignItems: 'center', gap: 12, borderRadius: 16, border: `1px solid ${colors.border}`, padding: 14, marginBottom: 10, backgroundColor: colors.surface}}>
            <div style={{width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt}}>
              <span style={{fontSize: 16, fontWeight: 800, color: colors.textSecondary}}>{d.name[0]}</span>
            </div>
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>{d.name}</div>
              <div style={{fontSize: 12, fontWeight: 600, marginTop: 2, color: colors.textMuted}}>On task · waiting for GPS</div>
            </div>
            <span style={{width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning}} />
          </div>
        ))}
      </div>
    </div>
  );
}
