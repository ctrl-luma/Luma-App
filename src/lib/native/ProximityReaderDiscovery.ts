import { NativeModules, Platform } from 'react-native';

const { ProximityReaderDiscoveryModule } = NativeModules;

export async function isProximityReaderDiscoveryAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !ProximityReaderDiscoveryModule) {
    return false;
  }
  try {
    return await ProximityReaderDiscoveryModule.isAvailable();
  } catch {
    return false;
  }
}

export async function showProximityReaderDiscoveryEducation(): Promise<{ success: boolean }> {
  if (!ProximityReaderDiscoveryModule) {
    throw new Error('ProximityReaderDiscovery native module not available');
  }
  return await ProximityReaderDiscoveryModule.showEducation();
}

export async function checkProximityReaderDeviceSupport(): Promise<{ isSupported: boolean; reason?: string }> {
  if (Platform.OS !== 'ios' || !ProximityReaderDiscoveryModule) {
    return { isSupported: false, reason: 'Not available on this platform' };
  }
  try {
    return await ProximityReaderDiscoveryModule.checkDeviceSupport();
  } catch {
    return { isSupported: false, reason: 'Failed to check device support' };
  }
}

export default {
  isAvailable: isProximityReaderDiscoveryAvailable,
  showEducation: showProximityReaderDiscoveryEducation,
  checkDeviceSupport: checkProximityReaderDeviceSupport,
};
