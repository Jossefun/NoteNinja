import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { BG_DEEP, BG_SURFACE, ACCENT_PURPLE } from './theme';

interface State {
  hasError: boolean;
  error: string | null;
}

interface Props {
  children: React.ReactNode;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.box}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              The app ran into an unexpected error. Tap below to try again.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={this.handleRestart}>
              <Text style={styles.btnText}>Restart</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DEEP,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  box: {
    backgroundColor: BG_SURFACE,
    borderRadius: 16,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ACCENT_PURPLE,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: ACCENT_PURPLE,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});