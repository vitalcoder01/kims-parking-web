import React, {useState} from 'react';
import {useTheme} from '../context/ThemeContext';
import {
  Surface, Text, Button, Field, IconButton, Avatar, SectionHeader, StatTile,
  EmptyState, Skeleton, SkeletonText, SegmentedControl, ProgressBar, Chip, Badge,
} from '../components/ui';
import {Icon} from '../components/Icon';
import {text as typeRamp, elevation as elevationTokens} from '../theme';

function Block({title, children}: {title: string; children: React.ReactNode}) {
  const {colors} = useTheme();
  return (
    <section style={{marginBottom: 36}}>
      <Text variant="overline" tone="muted" uppercase style={{display: 'block', marginBottom: 14, color: colors.textMuted}}>
        {title}
      </Text>
      {children}
    </section>
  );
}

const Row = ({children, style}: {children: React.ReactNode; style?: React.CSSProperties}) => (
  <div style={{display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', ...style}}>{children}</div>
);

export function Gallery() {
  const {colors, isDark, toggle} = useTheme();
  const [seg, setSeg] = useState('scan');
  const [chip, setChip] = useState('all');
  const [field, setField] = useState('TN 09 AB 1234');

  return (
    <div style={{minHeight: '100vh', backgroundColor: colors.background, color: colors.textPrimary}}>
      <div style={{maxWidth: 760, margin: '0 auto', padding: '32px 20px 80px'}}>
        {/* Header */}
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28}}>
          <div>
            <Text variant="display" style={{display: 'block', fontSize: 30}}>UI Kit</Text>
            <Text variant="body" tone="muted">KIMS Parking — warm-mono design system · {isDark ? 'Dark' : 'Light'}</Text>
          </div>
          <Button variant="secondary" size="sm" leftIcon={isDark ? 'sun' : 'moon'} onClick={toggle}>
            {isDark ? 'Light' : 'Dark'}
          </Button>
        </div>

        <Block title="Type ramp">
          <Surface padding={20}>
            {(Object.keys(typeRamp) as (keyof typeof typeRamp)[]).map(k => (
              <div key={k} style={{display: 'flex', alignItems: 'baseline', gap: 16, padding: '7px 0'}}>
                <span style={{width: 70, flexShrink: 0, fontSize: 11, color: colors.textMuted, fontFamily: 'monospace'}}>{k}</span>
                <Text variant={k}>The quick brown fox</Text>
              </div>
            ))}
          </Surface>
        </Block>

        <Block title="Elevation">
          <Row>
            {(Object.keys(elevationTokens.light) as (keyof typeof elevationTokens.light)[]).map(level => (
              <Surface key={level} elevation={level} padding={0} style={{width: 120, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <Text variant="label" tone="secondary">{level}</Text>
              </Surface>
            ))}
          </Row>
        </Block>

        <Block title="Buttons">
          <Row style={{marginBottom: 12}}>
            <Button variant="primary" rightIcon="arrowRight">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost" leftIcon="share">Ghost</Button>
            <Button variant="danger" leftIcon="close">Danger</Button>
          </Row>
          <Row style={{marginBottom: 12}}>
            <Button size="sm" leftIcon="plus">Small</Button>
            <Button size="md" leftIcon="key">Medium</Button>
            <Button size="lg" leftIcon="car">Large</Button>
          </Row>
          <Row>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <IconButton icon="back" ariaLabel="Back" />
            <IconButton icon="bell" ariaLabel="Alerts" variant="solid" />
            <IconButton icon="settings" ariaLabel="Settings" variant="plain" />
          </Row>
        </Block>

        <Block title="Fields">
          <div style={{maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16}}>
            <Field label="Vehicle number" value={field} onChange={setField} leftIcon="car" helper="As printed on the plate" />
            <Field label="Password" value="secret" onChange={() => {}} type="password"
              trailing={<IconButton icon="eye" ariaLabel="Show" variant="plain" size={28} />} />
            <Field label="Mobile" value="98" onChange={() => {}} error="Enter a 10-digit number" leftIcon="phone" />
          </div>
        </Block>

        <Block title="Segmented control & chips">
          <SegmentedControl
            value={seg}
            onChange={setSeg}
            segments={[
              {key: 'scan', label: 'Scan', icon: 'target'},
              {key: 'assign', label: 'Assign', icon: 'people', count: 3},
              {key: 'visitor', label: 'Visitor', icon: 'userCard'},
              {key: 'retr', label: 'Retrievals', icon: 'key', count: 1},
            ]}
            style={{marginBottom: 16}}
          />
          <Row>
            {[['all', 'All', 12], ['driver', 'Drivers', 5], ['parked', 'Parked', 7]].map(([k, l, c]) => (
              <Chip key={k as string} label={l as string} count={c as number} selected={chip === k} onClick={() => setChip(k as string)} />
            ))}
          </Row>
        </Block>

        <Block title="Stat tiles">
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12}}>
            <StatTile label="Cars parked" value={42} icon="parking" trend={{direction: 'up', label: '+8'}} />
            <StatTile label="Avg retrieval" value="3:12" icon="timer" hint="last 20 jobs" trend={{direction: 'down', label: '-18s'}} />
            <StatTile label="On shift" value={6} icon="people" emphasis />
            <StatTile label="Pending" value={3} icon="bellAlert" trend={{direction: 'flat', label: 'steady'}} />
          </div>
        </Block>

        <Block title="Badges & avatars">
          <Row style={{marginBottom: 14}}>
            <Badge label="Parked" variant="success" dot />
            <Badge label="En route" variant="info" dot />
            <Badge label="Waiting" variant="warning" dot />
            <Badge label="Cancelled" variant="error" dot />
            <Badge label="Draft" variant="muted" />
          </Row>
          <Row>
            <Avatar name="Aditya" status="online" />
            <Avatar name="Ravi" tone="neutral" status="busy" />
            <Avatar icon="stethoscope" />
            <Avatar name="Kim" size={52} status="off" />
          </Row>
        </Block>

        <Block title="Progress & loading">
          <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            <ProgressBar value={0.72} />
            <Surface padding={16}>
              <Row style={{gap: 12, flexWrap: 'nowrap', alignItems: 'flex-start'}}>
                <Skeleton circle width={44} />
                <div style={{flex: 1}}><SkeletonText lines={3} /></div>
              </Row>
            </Surface>
          </div>
        </Block>

        <Block title="A composed job card">
          <Surface interactive padding={16}>
            <div style={{display: 'flex', gap: 12, alignItems: 'flex-start'}}>
              <Avatar icon="carSide" tone="neutral" size={46} />
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8}}>
                  <Text variant="subhead" numberOfLines={1}>TN 09 AB 1234</Text>
                  <Badge label="En route" variant="info" dot />
                </div>
                <Text variant="caption" tone="muted" style={{display: 'block', marginTop: 2}}>Dr. Aditya Sharma · Cardiology</Text>
                <div style={{marginTop: 12, display: 'flex', alignItems: 'center', gap: 8}}>
                  <Icon name="timer" size={14} color={colors.textMuted} />
                  <Text variant="caption" tone="secondary">Arriving in ~3 min</Text>
                </div>
                <ProgressBar value={0.6} style={{marginTop: 8}} />
                <Row style={{marginTop: 14, flexWrap: 'nowrap'}}>
                  <Button size="sm" variant="secondary" fullWidth leftIcon="phone">Call</Button>
                  <Button size="sm" variant="primary" fullWidth rightIcon="check">Mark arrived</Button>
                </Row>
              </div>
            </div>
          </Surface>
        </Block>

        <Block title="Empty state">
          <Surface padding={0}>
            <EmptyState
              icon="key"
              title="No active retrievals"
              subtitle="When a doctor requests their car, it lands here for you to assign a driver."
              action={<Button variant="secondary" size="sm" leftIcon="refresh">Refresh</Button>}
            />
          </Surface>
        </Block>

        <Block title="Section header">
          <Surface padding={16}>
            <SectionHeader
              eyebrow="Today"
              title="Live operations"
              icon="live"
              action={<Button variant="ghost" size="sm" rightIcon="chevronRight">View all</Button>}
            />
            <Text variant="body" tone="muted">Section content sits below the header.</Text>
          </Surface>
        </Block>
      </div>
    </div>
  );
}
