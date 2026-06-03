import { Component } from 'react';

const C = {
  bg: '#0A1628', card: '#1E3A52', gold: '#F5A623',
  white: '#FFFFFF', muted: '#5A7A94', red: '#FF453A',
  section: '#152236', border: '#2A4A64', icy: '#A8C4D8',
};

export class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Sunfire] Tab crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding:'40px 20px', textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:16 }}>⚠️</div>
          <div style={{ fontSize:18, fontWeight:700, color:C.white, marginBottom:8 }}>
            Something went wrong
          </div>
          <div style={{ fontSize:14, color:C.muted, marginBottom:24, lineHeight:1.6 }}>
            This tab crashed. Your data is safe.
          </div>
          <div style={{ background:C.section, borderRadius:12, padding:14, marginBottom:24, textAlign:'left' }}>
            <div style={{ fontSize:11, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Error</div>
            <div style={{ fontSize:12, color:C.red, fontFamily:'monospace', wordBreak:'break-all' }}>
              {this.state.error.message}
            </div>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ height:48, padding:'0 24px', borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
