// STUBBED OUT FOR DEBUGGING - entire file disabled

export async function isProximityReaderDiscoveryAvailable(): Promise<boolean> {
  return false;
}

export async function showProximityReaderDiscoveryEducation(): Promise<{ success: boolean }> {
  throw new Error('ProximityReaderDiscovery disabled for debugging');
}

export async function checkProximityReaderDeviceSupport(): Promise<{ isSupported: boolean; reason?: string }> {
  return { isSupported: false, reason: 'Disabled for debugging' };
}

export default {
  isAvailable: isProximityReaderDiscoveryAvailable,
  showEducation: showProximityReaderDiscoveryEducation,
  checkDeviceSupport: checkProximityReaderDeviceSupport,
};
