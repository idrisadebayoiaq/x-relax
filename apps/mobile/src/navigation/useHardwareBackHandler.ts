import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { navigationRef } from './navigationRef';

/**
 * Android hardware back: pop the navigation stack when possible instead of exiting the app.
 */
export function useHardwareBackHandler() {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigationRef.isReady()) return false;
      if (navigationRef.canGoBack()) {
        navigationRef.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);
}
