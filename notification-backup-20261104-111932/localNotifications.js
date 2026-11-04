import { Platform } from 'react-native';
import * as ExpoNotifications from 'expo-notifications';

export {
  ExpoNotifications,
};

export const {
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  AndroidImportance,
  SchedulableTriggerInputTypes,
} = ExpoNotifications;

// Keep this binding available even when the app is rendered on web, where the
// native scheduler is not exposed by expo-notifications.
export async function getAllScheduledNotificationsAsync() {
  if (typeof ExpoNotifications.getAllScheduledNotificationsAsync !== 'function') {
    return [];
  }

  return ExpoNotifications.getAllScheduledNotificationsAsync();
}

export function isLocalNotificationsSupported() {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

export function supportsAndroidNotificationChannels(platform = Platform) {
  return platform.OS === 'android' && Number(platform.Version) >= 26;
}

export function setNotificationHandlerSafely(handler) {
  if (!isLocalNotificationsSupported()) return;

  try {
    if (typeof setNotificationHandler === 'function') {
      setNotificationHandler(handler);
    }
  } catch (error) {
    console.warn('Notification handler setup failed:', error);
  }
}

export async function setAndroidNotificationChannel(channelId, channel) {
  if (
    !supportsAndroidNotificationChannels() ||
    typeof setNotificationChannelAsync !== 'function'
  ) {
    return null;
  }

  try {
    return await setNotificationChannelAsync(channelId, channel);
  } catch (error) {
    console.warn('Android notification channel setup failed:', error);
    return null;
  }
}
