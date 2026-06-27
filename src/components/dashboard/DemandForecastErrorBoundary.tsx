import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Local boundary for DemandForecastCard so a render-time crash
 * (e.g. malformed AI date payload) shows a compact fallback tile
 * instead of blanking the whole MotorIQ panel.
 */
export class DemandForecastErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[DemandForecastErrorBoundary]', error);
  }

  handleRetry = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center text-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Forecast temporarily unavailable</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              We couldn't render the demand forecast. The rest of MotorIQ is unaffected.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleRetry} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
}
