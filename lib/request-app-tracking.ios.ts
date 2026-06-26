import {
  getTrackingPermissionsAsync,
  isAvailable,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';

/** Delay after the first screen is visible — ATT must present over an active window (esp. iPad). */
const ATT_PRESENT_DELAY_MS = 800;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Requests App Tracking Transparency when still undetermined.
 * Call only after splash is hidden and the root UI is on screen.
 */
export const requestAppTrackingIfNeeded = async (): Promise<void> => {
  await sleep(ATT_PRESENT_DELAY_MS);

  if (!isAvailable()) {
    return;
  }

  const { status } = await getTrackingPermissionsAsync();
  if (status !== 'undetermined') {
    return;
  }

  await requestTrackingPermissionsAsync();
};
