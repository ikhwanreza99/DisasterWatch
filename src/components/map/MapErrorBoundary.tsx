import React from 'react';

/** A provider failure must not remove navigation or the reporting form. */
export class MapErrorBoundary extends React.Component<{children: React.ReactNode; onFailure: () => void}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
