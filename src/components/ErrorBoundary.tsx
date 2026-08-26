import React from 'react';

/*
 * Catches render-time exceptions so one broken screen stops being a blank
 * page.
 *
 * React unmounts the entire tree when a render throws and nothing catches
 * it. With no boundary anywhere in this app, that meant every render bug --
 * whatever its cause, wherever it happened -- produced exactly the same
 * white screen with no message, no stack, and no way back except a manual
 * reload. That is what made the valet retrieval crash so hard to pin down:
 * the symptom carried none of the information needed to explain it.
 *
 * This does two things. Users get a screen that says something went wrong
 * and a way to recover, instead of a blank one they assume is a dead app.
 * And whoever is debugging gets the actual error and component stack on
 * screen -- on the phone, in the field, without a laptop attached.
 *
 * Deliberately NOT reported to a backend. There is no error-tracking
 * service wired up here, and inventing a silent network call from a crash
 * handler is how you turn one bug into two.
 *
 * Note this cannot catch everything. React error boundaries see render,
 * lifecycle and constructor errors -- not event handlers, not async
 * callbacks, not anything inside setTimeout. Those still surface as
 * unhandled rejections in the console. What it does cover is the class
 * that blanks the screen.
 */

interface Props {
  children: React.ReactNode;
  /** Shown above the error. Defaults to a generic line. */
  label?: string;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {error: null, componentStack: null};

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {error};
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep it in the console too — the on-screen copy is truncated for
    // readability, and the console keeps the full stack and the source map.
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.setState({componentStack: info.componentStack ?? null});
  }

  private reset = () => this.setState({error: null, componentStack: null});

  render() {
    const {error, componentStack} = this.state;
    if (!error) return this.props.children;

    // Plain inline styles and no theme hook: this renders when something
    // has already gone wrong, so it must not depend on any of the app's
    // own context providers still being healthy.
    return (
      <div
        role="alert"
        style={{
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          padding: 24,
          background: '#14151A',
          color: '#F2F3F5',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          overflowY: 'auto',
        }}
      >
        <div style={{fontSize: 18, fontWeight: 800}}>
          {this.props.label ?? 'Something went wrong on this screen'}
        </div>
        <div style={{fontSize: 13, lineHeight: 1.5, color: '#A8ADB8'}}>
          The rest of the app is still running. Going back usually works; if it
          keeps happening, send this message on.
        </div>

        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 10,
            background: '#0C0D10',
            border: '1px solid #2A2C33',
            color: '#FF8A80',
            fontSize: 12,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowX: 'auto',
          }}
        >
          {error.name}: {error.message}
          {componentStack ? `\n${componentStack.split('\n').slice(0, 12).join('\n')}` : ''}
        </pre>

        <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
          {/* Try again re-renders the same subtree, which is enough when the
              cause was transient state. Reload is the fallback for when it
              is not. */}
          <button
            onClick={this.reset}
            style={{
              borderRadius: 10, border: '1px solid #3A3D46', padding: '10px 16px',
              background: '#22242B', color: '#F2F3F5', fontWeight: 700, fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              borderRadius: 10, border: 'none', padding: '10px 16px',
              background: '#F2F3F5', color: '#14151A', fontWeight: 800, fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
