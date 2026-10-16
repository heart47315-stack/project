import { Platform } from 'react-native';
import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications/build/NotificationPermissions';
import { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';

export {
  getPermissionsAsync,
  requestPermissionsAsync,
  getAllScheduledNotificationsAsync,
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  AndroidImportance,
  SchedulableTriggerInputTypes,
};

export function isLocalNotificationsSupported() {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

export function supportsAndroidNotificationChannels(platform = Platform) {
  return platform.OS === 'android' && Number(platform.Version) >= 26;
}

export function setNotificationHandlerSafely(handler) {
  if (!isLocalNotificationsSupported()) return;

  try {
    setNotificationHandler(handler);
  } catch (error) {
    console.warn('Notification handler setup failed:', error);
  }
}

export async function setAndroidNotificationChannel(channelId, channel) {
  if (!supportsAndroidNotificationChannels()) return null;

  try {
    return await setNotificationChannelAsync(channelId, channel);
  } catch (error) {
    console.warn('Android notification channel setup failed:', error);
    return null;
  }
}
