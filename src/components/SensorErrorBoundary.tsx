/**
 * SensorErrorBoundary: Wrap sensor dashboard to catch and isolate errors
 *
 * LAYER 6: If a single sensor crashes, the error boundary prevents it from
 * taking down the entire screen or app. Users get a retry prompt instead.
 */

import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  fallbackUI?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class SensorErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for analytics/debugging
    console.error('[SensorErrorBoundary] Caught error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // You could also log to an error tracking service here
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallbackUI ? (
        <View style={styles.container}>{this.props.fallbackUI}</View>
      ) : (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.errorContent}>
            <View style={styles.errorBox}>
              <Text style={styles.errorEmoji}>⚠️</Text>
              <Text style={styles.errorTitle}>Sensor Error</Text>
              <Text style={styles.errorMessage}>
                One or more sensors encountered an error. The app is still running, but
                sensor data may be unavailable.
              </Text>

              {this.state.error && (
                <View style={styles.errorDetails}>
                  <Text style={styles.errorDetailsLabel}>Error Details:</Text>
                  <Text style={styles.errorDetailsText}>
                    {this.state.error.message}
                  </Text>
                </View>
              )}

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <View style={styles.stackTrace}>
                  <Text style={styles.stackTraceLabel}>Stack Trace:</Text>
                  <Text style={styles.stackTraceText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.retryButton}
                onPress={this.handleReset}
                activeOpacity={0.7}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>

              <Text style={styles.hint}>
                If the problem persists, try reconnecting your device or restarting the app.
              </Text>
            </View>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

/**
 * Combined error boundary that wraps both sensor logic and disconnection handling
 */
interface SensorDashboardErrorBoundaryProps {
  children: ReactNode;
  onDisconnect?: () => void;
}

export class SensorDashboardErrorBoundary extends React.Component<
  SensorDashboardErrorBoundaryProps,
  State & { isDisconnected: boolean }
> {
  constructor(props: SensorDashboardErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isDisconnected: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SensorDashboardErrorBoundary] Caught error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  handleDisconnect = () => {
    this.setState({ isDisconnected: true });
    if (this.props.onDisconnect) {
      this.props.onDisconnect();
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isDisconnected: false,
    });
  };

  render() {
    if (this.state.hasError || this.state.isDisconnected) {
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.errorContent}>
            <View style={styles.errorBox}>
              <Text style={styles.errorEmoji}>
                {this.state.isDisconnected ? '📡' : '⚠️'}
              </Text>
              <Text style={styles.errorTitle}>
                {this.state.isDisconnected
                  ? 'Device Disconnected'
                  : 'Sensor Dashboard Error'}
              </Text>
              <Text style={styles.errorMessage}>
                {this.state.isDisconnected
                  ? 'The device has been disconnected. Please reconnect to resume sensor monitoring.'
                  : 'The sensor dashboard encountered an error. Please try reconnecting your device.'}
              </Text>

              {this.state.error && (
                <View style={styles.errorDetails}>
                  <Text style={styles.errorDetailsLabel}>Details:</Text>
                  <Text style={styles.errorDetailsText}>
                    {this.state.error.message}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.retryButton}
                onPress={this.handleReset}
                activeOpacity={0.7}
              >
                <Text style={styles.retryButtonText}>
                  {this.state.isDisconnected ? 'Reconnect' : 'Retry'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.hint}>
                Make sure your Smart Stim device is powered on and within range.
              </Text>
            </View>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },

  errorContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },

  errorBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderTopWidth: 3,
    borderTopColor: '#FF5722',
  },

  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },

  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },

  errorDetails: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    width: '100%',
  },

  errorDetailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  errorDetailsText: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
    lineHeight: 16,
  },

  stackTrace: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    width: '100%',
    maxHeight: 120,
  },

  stackTraceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  stackTraceText: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'monospace',
    lineHeight: 14,
  },

  retryButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginVertical: 16,
    alignItems: 'center',
    width: 200,
  },

  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  hint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
