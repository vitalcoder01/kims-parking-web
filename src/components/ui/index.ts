// KIMS Parking — UI primitives kit.
//
// One import site for the shared building blocks. Screens compose from these
// instead of re-declaring card borders, button pills, field anatomy and empty
// states inline. Everything here is theme-aware (warm-mono) and built on the
// elevation / motion / type tokens in theme/tokens.ts.

export {Surface} from './Surface';
export {Text} from './Text';
export {Button} from './Button';
export {Field} from './Field';
export {IconButton} from './IconButton';
export {Avatar} from './Avatar';
export {SectionHeader} from './SectionHeader';
export {StatTile} from './StatTile';
export {EmptyState} from './EmptyState';
export {Skeleton, SkeletonText} from './Skeleton';
export {SegmentedControl} from './SegmentedControl';
export type {Segment} from './SegmentedControl';
export {ProgressBar} from './ProgressBar';
export {Chip} from './Chip';
export {Divider} from './Divider';

// Re-exported from the existing component set so the kit is one import.
export {Badge} from '../Badge';

// Animation & FX — from React Bits (reactbits.dev), wired with GSAP.
export {BlurText} from './BlurText';
export {Aurora} from './Aurora';
