import React, {useRef, useState, useEffect} from 'react';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {usersApi} from '../services/api';
import {Icon} from '../components/Icon';
import {PressableScale} from '../components/PressableScale';

// Same three.js mini-car scene the mobile app renders in a WebView — the
// scene HTML is identical; here it lives in an iframe (srcDoc) and receives
// colour/plate updates via postMessage.
function buildCarSceneHTML(initialColor: string, initialPlate: string, bg: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  * { margin: 0; padding: 0; }
  html, body, #scene { width: 100%; height: 100%; background: ${bg}; overflow: hidden; }
</style>
</head>
<body>
<div id="scene"></div>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
<script>
  function setSRGB(renderer) {
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else renderer.outputEncoding = THREE.sRGBEncoding;
  }

  function buildMiniCar(colour) {
    var car = new THREE.Group();

    var paint = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colour),
      metalness: 0.2, roughness: 0.3,
      clearcoat: 1.0, clearcoatRoughness: 0.06,
    });
    var glass = new THREE.MeshPhysicalMaterial({
      color: 0x11181d, metalness: 0.9, roughness: 0.1,
      clearcoat: 1.0, clearcoatRoughness: 0.05,
    });
    var darkMatte = new THREE.MeshStandardMaterial({color: 0x14151a, roughness: 0.95});
    var innerDark = new THREE.MeshStandardMaterial({color: 0x0f1013, roughness: 1, side: THREE.DoubleSide});
    var tireMat = new THREE.MeshStandardMaterial({color: 0x121212, roughness: 0.9});
    var rimMat  = new THREE.MeshStandardMaterial({color: 0xd9dde2, metalness: 0.9, roughness: 0.25});

    var s = new THREE.Shape();
    s.moveTo(-2.30, 0.30);
    s.lineTo(-2.42, 0.52);
    s.quadraticCurveTo(-2.46, 0.74, -2.16, 0.80);
    s.quadraticCurveTo(-1.20, 0.94, -0.40, 0.96);
    s.lineTo(1.10, 1.00);
    s.quadraticCurveTo(1.90, 1.00, 2.22, 0.88);
    s.quadraticCurveTo(2.44, 0.80, 2.40, 0.55);
    s.lineTo(2.32, 0.30);
    s.lineTo(1.81, 0.30);
    s.absarc(1.35, 0.30, 0.46, 0, Math.PI, false);
    s.lineTo(-0.89, 0.30);
    s.absarc(-1.35, 0.30, 0.46, 0, Math.PI, false);
    s.closePath();

    var bodyGeo = new THREE.ExtrudeGeometry(s, {
      depth: 1.6, steps: 1, curveSegments: 22,
      bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3,
    });
    bodyGeo.translate(0, 0, -0.8);
    car.add(new THREE.Mesh(bodyGeo, paint));

    var sill = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.14, 1.5), darkMatte);
    sill.position.set(0, 0.31, 0);
    car.add(sill);

    var g = new THREE.Shape();
    g.moveTo(-0.95, 0.92);
    g.lineTo(-0.30, 1.44);
    g.quadraticCurveTo(0.15, 1.51, 0.62, 1.47);
    g.lineTo(1.55, 0.92);
    g.closePath();
    var canopyGeo = new THREE.ExtrudeGeometry(g, {
      depth: 1.34, steps: 1, curveSegments: 14,
      bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2,
    });
    canopyGeo.translate(0, 0, -0.67);
    car.add(new THREE.Mesh(canopyGeo, glass));

    var fin = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 10), darkMatte);
    fin.scale.set(2.2, 1, 1); fin.rotation.z = -0.5; fin.position.set(1.02, 1.28, 0);
    car.add(fin);

    [-1.35, 1.35].forEach(function(x) {
      var liner = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.5, 22, 1, true), innerDark);
      liner.rotation.x = Math.PI / 2;
      liner.position.set(x, 0.3, 0);
      car.add(liner);
    });

    [[-1.35, 0.74], [-1.35, -0.74], [1.35, 0.74], [1.35, -0.74]].forEach(function(p) {
      var x = p[0], z = p[1];
      var w = new THREE.Group();
      var tire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.24, 26), tireMat);
      tire.rotation.x = Math.PI / 2;
      w.add(tire);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.045, 10, 22), rimMat);
      ring.position.z = 0.055;
      w.add(ring);
      for (var i = 0; i < 5; i++) {
        var spoke = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 0.045), rimMat);
        spoke.rotation.z = (i / 5) * Math.PI * 2;
        spoke.position.z = 0.055;
        w.add(spoke);
      }
      var backing = new THREE.Mesh(new THREE.CircleGeometry(0.43, 22), innerDark);
      backing.position.z = -0.145;
      w.add(backing);
      w.position.set(x, 0.35, z);
      if (z < 0) w.rotation.y = Math.PI;
      car.add(w);
    });

    [0.5, -0.5].forEach(function(z) {
      var lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.09, 0.42),
        new THREE.MeshStandardMaterial({color: 0xfffdf2, emissive: 0xfff3cc, emissiveIntensity: 1.0, roughness: 0.3})
      );
      lamp.position.set(-2.41, 0.71, z);
      lamp.rotation.y = z > 0 ? -0.12 : 0.12;
      car.add(lamp);
    });

    var tailL = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.07, 1.34),
      new THREE.MeshStandardMaterial({color: 0xff3344, emissive: 0xff1e33, emissiveIntensity: 1.3, roughness: 0.35})
    );
    tailL.position.set(2.4, 0.8, 0);
    car.add(tailL);

    var grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.95), darkMatte);
    grille.position.set(-2.42, 0.42, 0);
    car.add(grille);

    [0.88, -0.88].forEach(function(z) {
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.16), paint);
      head.position.set(-0.58, 1.02, z);
      car.add(head);
    });

    return {group: car, paint: paint};
  }

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(4.2, 2.6, 5.2);
  camera.lookAt(0, 0.4, 0);

  var renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  setSRGB(renderer);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('scene').appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8f99a3, 0.95));
  var key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(5, 8, 4);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xcfe0ff, 0.35);
  rim.position.set(-6, 4, -6);
  scene.add(rim);

  var carApi = buildMiniCar('${initialColor}');
  var car = carApi.group;
  car.rotation.y = 0.6;
  scene.add(car);

  var ground = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 32),
    new THREE.MeshStandardMaterial({color: 0x000000, transparent: true, opacity: 0.08})
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.001;
  scene.add(ground);

  var plateCanvas = document.createElement('canvas');
  plateCanvas.width = 256; plateCanvas.height = 64;
  var plateCtx = plateCanvas.getContext('2d');
  var plateTex = new THREE.CanvasTexture(plateCanvas);
  function drawPlate(text) {
    plateCtx.fillStyle = '#f5f5f0';
    plateCtx.fillRect(0, 0, 256, 64);
    plateCtx.strokeStyle = '#111';
    plateCtx.lineWidth = 4;
    plateCtx.strokeRect(4, 4, 248, 56);
    plateCtx.fillStyle = '#111';
    plateCtx.font = 'bold 34px monospace';
    plateCtx.textAlign = 'center';
    plateCtx.textBaseline = 'middle';
    plateCtx.fillText(text || 'YOUR CAR', 128, 34);
    plateTex.needsUpdate = true;
  }
  drawPlate('${initialPlate}');
  var plateMat = new THREE.MeshBasicMaterial({map: plateTex});
  var plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.16), plateMat);
  plate.position.set(-2.46, 0.34, 0);
  plate.rotation.y = -Math.PI / 2;
  car.add(plate);

  function setColor(hex) {
    carApi.paint.color.set(hex);
  }

  function onMessage(e) {
    try {
      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data.type === 'setColor') setColor(data.color);
      if (data.type === 'setPlate') drawPlate(data.plate);
    } catch (err) {}
  }
  window.addEventListener('message', onMessage);

  function animate() {
    requestAnimationFrame(animate);
    car.rotation.y += 0.006;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
</script>
</body>
</html>`;
}

// Exactly 7 defaults + the "More" tile fills two full rows of 4.
const COLORS = [
  {name: 'White',  hex: '#FFFFFF'},
  {name: 'Black',  hex: '#1C1C1E'},
  {name: 'Red',    hex: '#DC2626'},
  {name: 'Blue',   hex: '#2563EB'},
  {name: 'Silver', hex: '#9CA3AF'},
  {name: 'Grey',   hex: '#4B5563'},
  {name: 'Green',  hex: '#16A34A'},
];

const MORE_COLORS = [
  {name: 'Yellow',  hex: '#F5B300'},
  {name: 'Orange',  hex: '#EA580C'},
  {name: 'Maroon',  hex: '#7C2D12'},
  {name: 'Navy',    hex: '#1E3A8A'},
  {name: 'Purple',  hex: '#7C3AED'},
  {name: 'Teal',    hex: '#0D9488'},
  {name: 'Pink',    hex: '#DB2777'},
  {name: 'Lime',    hex: '#65A30D'},
  {name: 'Beige',   hex: '#D6C7A1'},
  {name: 'Bronze',  hex: '#92553A'},
  {name: 'Sky',     hex: '#0EA5E9'},
];

function isLightColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 175;
}

export function VehicleSetupScreen({onBack}: {onBack: () => void}) {
  const {colors} = useTheme();
  const {user, updateProfile} = useAuth();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const [vehicleNumber, setVehicleNumber] = useState(user?.carNumber ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [vehicleModel, setVehicleModel] = useState(user?.carModel ?? '');
  const [vehicleType, setVehicleType] = useState<'car' | 'bike'>(user?.vehicleType ?? 'car');
  const [selectedColor, setSelectedColor] = useState(user?.carColor || COLORS[1].hex);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Already saved a vehicle number before -> land on the summary view.
  const [mode, setMode] = useState<'view' | 'edit'>(user?.carNumber ? 'view' : 'edit');

  const post = (msg: object) => frameRef.current?.contentWindow?.postMessage(JSON.stringify(msg), '*');

  useEffect(() => { post({type: 'setColor', color: selectedColor}); }, [selectedColor]);
  useEffect(() => { post({type: 'setPlate', plate: vehicleNumber}); }, [vehicleNumber]);

  const handleSave = async () => {
    if (!vehicleNumber.trim()) {
      window.alert('Please enter your vehicle number before saving.');
      return;
    }
    setSaving(true);
    try {
      const updated = await usersApi.updateMe({
        carNumber: vehicleNumber.trim(),
        phone: phone.trim() || undefined,
        carModel: vehicleModel.trim() || undefined,
        carColor: selectedColor,
        vehicleType,
      });
      updateProfile({
        carNumber: updated.carNumber, phone: updated.phone,
        carModel: updated.carModel, carColor: updated.carColor, vehicleType: updated.vehicleType,
      });
      setMode('view');
    } catch (err: any) {
      window.alert(err.message || 'Could not save vehicle details');
    } finally {
      setSaving(false);
    }
  };

  const handleHelp = () => {
    window.alert('Add your vehicle number, phone number, and pick a body colour — the preview above updates live. This is saved to your account and used by the valet team.');
  };

  // srcDoc is only computed once — colour/plate updates go via postMessage,
  // so the scene never reloads while editing.
  const [sceneHTML] = useState(() => buildCarSceneHTML(selectedColor, vehicleNumber, colors.surface));
  const isCustomColor = ![...COLORS, ...MORE_COLORS].some(c => c.hex === selectedColor);
  const colorName = [...COLORS, ...MORE_COLORS].find(c => c.hex === selectedColor)?.name ?? 'Custom';

  const fieldLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 4,
    color: colors.textMuted, display: 'block',
  };
  const inputRow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', border: `1.5px solid ${colors.border}`,
    borderRadius: 14, padding: '0 10px', height: 58, marginBottom: 16,
    backgroundColor: colors.surface, boxShadow: '0 3px 8px rgba(0,0,0,0.06)',
  };
  const iconWrap: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center',
    justifyContent: 'center', marginRight: 10, backgroundColor: colors.cardAlt, flexShrink: 0,
  };
  const inputStyle: React.CSSProperties = {
    flex: 1, fontSize: 15, fontWeight: 600, border: 'none', background: 'transparent',
    color: colors.textPrimary, minWidth: 0,
  };

  const swatchGrid: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', columnGap: 14, rowGap: 18, marginBottom: 24,
  };

  const renderSwatch = (c: {name: string; hex: string}, onPick: () => void) => {
    const active = c.hex === selectedColor;
    return (
      <PressableScale key={c.hex} onClick={onPick} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
        <span style={{
          width: 48, height: 48, borderRadius: 24, backgroundColor: c.hex,
          border: `${active ? 3 : 1}px solid ${active ? colors.textPrimary : colors.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {active && <Icon name="checkBold" size={16} color={isLightColor(c.hex) ? '#111' : '#fff'} />}
        </span>
        <span style={{fontSize: 10, fontWeight: 600, color: colors.textSecondary}}>{c.name}</span>
      </PressableScale>
    );
  };

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background}}>
      <div style={{padding: '20px 20px 40px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
          <PressableScale
            onClick={onBack}
            style={{
              width: 44, height: 44, borderRadius: 22, backgroundColor: colors.cardAlt,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <Icon name="back" size={20} color={colors.textPrimary} />
          </PressableScale>
          <PressableScale
            onClick={handleHelp}
            style={{
              width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <Icon name="help" size={18} color={colors.textOnPrimary} />
          </PressableScale>
        </div>

        <div style={{fontSize: 28, fontWeight: 900, color: colors.textPrimary}}>Vehicle Setup</div>
        <div style={{fontSize: 13, marginTop: 4, marginBottom: 18, color: colors.textSecondary}}>
          {mode === 'edit' ? 'Add your vehicle details and pick a colour' : 'Your saved vehicle details'}
        </div>

        <div style={{
          borderRadius: 20, border: `2px solid ${colors.textPrimary}`, overflow: 'hidden',
          marginBottom: 24, height: 220, backgroundColor: colors.surface,
          boxShadow: '0 6px 12px rgba(0,0,0,0.1)',
        }}>
          <iframe
            ref={frameRef}
            title="3D vehicle preview"
            srcDoc={sceneHTML}
            onLoad={() => { post({type: 'setColor', color: selectedColor}); post({type: 'setPlate', plate: vehicleNumber}); }}
            style={{width: '100%', height: '100%', border: 'none', display: 'block'}}
          />
        </div>

        {mode === 'view' ? (
          <>
            <div style={{borderRadius: 18, border: `1px solid ${colors.border}`, overflow: 'hidden', marginBottom: 20, backgroundColor: colors.surface}}>
              {[
                {icon: 'car' as const, label: 'Vehicle Number', value: vehicleNumber || '—'},
                {icon: 'car' as const, label: 'Vehicle Model', value: vehicleModel || '—'},
                {icon: vehicleType === 'bike' ? 'bike' as const : 'car' as const, label: 'Vehicle Type', value: vehicleType === 'bike' ? 'Bike' : 'Car'},
                {icon: 'phone' as const, label: 'Phone Number', value: phone || '—'},
                {icon: 'car' as const, label: 'Body Colour', value: colorName},
              ].map((row, i, arr) => (
                <div key={row.label} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 14,
                  borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${colors.divider}`,
                }}>
                  <span style={iconWrap}>
                    <Icon name={row.icon} size={16} color={colors.textSecondary} />
                  </span>
                  <span style={{flex: 1}}>
                    <span style={{display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 3, color: colors.textMuted}}>{row.label.toUpperCase()}</span>
                    <span style={{display: 'block', fontSize: 15, fontWeight: 800, color: colors.textPrimary}}>{row.value}</span>
                  </span>
                </div>
              ))}
            </div>

            <PressableScale
              onClick={() => setMode('edit')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                borderRadius: 14, height: 54, width: '100%', backgroundColor: colors.primary,
              }}>
              <Icon name="edit" size={17} color={colors.textOnPrimary} />
              <span style={{fontSize: 15, fontWeight: 800, color: colors.textOnPrimary}}>Edit Vehicle Details</span>
            </PressableScale>
          </>
        ) : (
          <>
            <label style={fieldLabel}>VEHICLE NUMBER</label>
            <div style={inputRow}>
              <span style={iconWrap}><Icon name="car" size={16} color={colors.textPrimary} /></span>
              <input
                style={inputStyle}
                value={vehicleNumber}
                onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                placeholder="e.g. TN09 AB 1234"
                onKeyDown={e => { if (e.key === 'Enter') modelInputRef.current?.focus(); }}
              />
            </div>

            <label style={fieldLabel}>VEHICLE MODEL (OPTIONAL)</label>
            <div style={inputRow}>
              <span style={iconWrap}><Icon name="car" size={16} color={colors.textPrimary} /></span>
              <input
                ref={modelInputRef}
                style={inputStyle}
                value={vehicleModel}
                onChange={e => setVehicleModel(e.target.value)}
                placeholder="e.g. Maruti Swift"
                onKeyDown={e => { if (e.key === 'Enter') phoneInputRef.current?.focus(); }}
              />
            </div>

            <label style={fieldLabel}>VEHICLE TYPE</label>
            <div style={{display: 'flex', gap: 10, marginBottom: 16}}>
              {(['car', 'bike'] as const).map(t => {
                const on = vehicleType === t;
                return (
                  <PressableScale
                    key={t}
                    onClick={() => setVehicleType(t)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      border: `1.5px solid ${on ? colors.primary : colors.border}`, borderRadius: 14, height: 50,
                      backgroundColor: on ? colors.primary : colors.surface,
                    }}>
                    <Icon name={t === 'car' ? 'car' : 'bike'} size={16} color={on ? colors.textOnPrimary : colors.textSecondary} />
                    <span style={{fontSize: 14, fontWeight: 700, color: on ? colors.textOnPrimary : colors.textSecondary}}>{t === 'car' ? 'Car' : 'Bike'}</span>
                  </PressableScale>
                );
              })}
            </div>

            <label style={fieldLabel}>PHONE NUMBER</label>
            <div style={inputRow}>
              <span style={iconWrap}><Icon name="phone" size={16} color={colors.textPrimary} /></span>
              <input
                ref={phoneInputRef}
                style={inputStyle}
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit number"
                inputMode="numeric"
              />
            </div>

            <label style={fieldLabel}>BODY COLOUR</label>
            <div style={swatchGrid}>
              {COLORS.map(c => renderSwatch(c, () => setSelectedColor(c.hex)))}
              <PressableScale onClick={() => setPickerOpen(true)} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
                <span style={{
                  width: 48, height: 48, borderRadius: 24,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: isCustomColor
                    ? `3px solid ${colors.textPrimary}`
                    : `1.5px dashed ${colors.border}`,
                  backgroundColor: isCustomColor ? selectedColor : colors.cardAlt,
                }}>
                  <Icon
                    name={isCustomColor ? 'checkBold' : 'plus'}
                    size={isCustomColor ? 16 : 18}
                    color={isCustomColor ? (isLightColor(selectedColor) ? '#111' : '#fff') : colors.textSecondary}
                  />
                </span>
                <span style={{fontSize: 10, fontWeight: 600, color: colors.textSecondary}}>More</span>
              </PressableScale>
            </div>

            <PressableScale
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                borderRadius: 14, height: 54, width: '100%',
                backgroundColor: colors.primary, opacity: saving ? 0.6 : 1,
              }}>
              {saving ? <span className="spinner" /> : (
                <>
                  <Icon name="save" size={17} color={colors.textOnPrimary} />
                  <span style={{fontSize: 15, fontWeight: 800, color: colors.textOnPrimary}}>Save Vehicle</span>
                  <Icon name="arrowRight" size={17} color={colors.textOnPrimary} />
                </>
              )}
            </PressableScale>
          </>
        )}
      </div>

      {/* Colour picker popup */}
      {pickerOpen && (
        <div
          onClick={() => setPickerOpen(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 100,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{width: '100%', maxWidth: 420, borderRadius: 22, padding: 20, backgroundColor: colors.surface}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18}}>
              <span style={{fontSize: 18, fontWeight: 900, color: colors.textPrimary}}>Choose a colour</span>
              <PressableScale
                onClick={() => setPickerOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cardAlt,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <Icon name="close" size={16} color={colors.textPrimary} />
              </PressableScale>
            </div>
            <div style={{...swatchGrid, marginBottom: 0}}>
              {MORE_COLORS.map(c => renderSwatch(c, () => { setSelectedColor(c.hex); setPickerOpen(false); }))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
