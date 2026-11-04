import { Platform } from 'react-native';
import * as ExpoNotifications from 'expo-notifications';

export const NOTIFICATION_CHANNEL_ID = 'medsafe-reminders-v2';
export const LEGACY_NOTIFICATION_CHANNEL_ID = 'reminders';
export const MAX_SCHEDULED_NOTIFICATIONS = 50;
export const NOTIFICATION_TIME_ZONE = 'Asia/Bangkok';
export const ANDROID_NOTIFICATION_CHANNEL = {
  name: 'MEDSAFE reminders',
  importance: ExpoNotifications.AndroidImportance?.HIGH,
  sound: 'default',
  vibrationPattern: [0, 250, 250, 250],
  enableVibrate: true,
  lockscreenVisibility: ExpoNotifications.AndroidNotificationVisibility?.PUBLIC,
};

export {
  ExpoNotifications,
};

export const {
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  setNotificationChannelAsync,
  getNotificationChannelAsync,
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

export async function getLastNotificationResponseAsync() {
  if (typeof ExpoNotifications.getLastNotificationResponseAsync !== 'function') {
    return null;
  }
  return ExpoNotifications.getLastNotificationResponseAsync();
}

export function addNotificationResponseListener(listener) {
  if (typeof ExpoNotifications.addNotificationResponseReceivedListener !== 'function') {
    return { remove: () => {} };
  }
  return ExpoNotifications.addNotificationResponseReceivedListener(listener);
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

export function getNotificationHandler() {
  return {
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  };
}

export async function configureLocalNotifications() {
  if (!isLocalNotificationsSupported()) return null;

  setNotificationHandlerSafely(getNotificationHandler());
  return setAndroidNotificationChannel(
    NOTIFICATION_CHANNEL_ID,
    ANDROID_NOTIFICATION_CHANNEL
  );
}

export async function getAndroidNotificationChannel() {
  if (!supportsAndroidNotificationChannels() || typeof getNotificationChannelAsync !== 'function') {
    return null;
  }

  try {
    return await getNotificationChannelAsync(NOTIFICATION_CHANNEL_ID);
  } catch (error) {
    console.warn('Android notification channel lookup failed:', error);
    return null;
  }
}

export async function requestNotificationPermissions() {
  if (!isLocalNotificationsSupported()) {
    return { granted: false, status: 'undetermined' };
  }

  await configureLocalNotifications();
  const current = await getPermissionsAsync();
  if (current.granted) {
    return {
      ...current,
      channelSoundEnabled: await isNotificationChannelSoundEnabled(),
    };
  }

  // expo-notifications maps this request to POST_NOTIFICATIONS on Android 13+.
  const requested = await requestPermissionsAsync({
    android: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  return {
    ...requested,
    channelSoundEnabled: await isNotificationChannelSoundEnabled(),
  };
}

export async function isNotificationChannelSoundEnabled() {
  const channel = await getAndroidNotificationChannel();
  return channel ? channel.sound !== null : true;
}

export function parseLocalDateTime(dateValue, timeValue = '09:00') {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ''));
  const timeMatch = /^(\d{2}):(\d{2})/.exec(String(timeValue || ''));
  if (!dateMatch || !timeMatch) return new Date(NaN);

  const [, year, month, day] = dateMatch.map(Number);
  const [, hour, minute] = timeMatch.map(Number);
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day ||
    result.getHours() !== hour ||
    result.getMinutes() !== minute
  ) return new Date(NaN);
  return result;
}

export function buildNotificationTrigger({ date, repeat = 'none' }) {
  if (repeat === 'daily') {
    return { type: SchedulableTriggerInputTypes.DAILY, hour: date.getHours(), minute: date.getMinutes() };
  }
  if (repeat === 'weekly') {
    return { type: SchedulableTriggerInputTypes.WEEKLY, weekday: date.getDay() || 7, hour: date.getHours(), minute: date.getMinutes() };
  }
  if (repeat === 'monthly') {
    return { type: SchedulableTriggerInputTypes.MONTHLY, day: date.getDate(), hour: date.getHours(), minute: date.getMinutes() };
  }
  return { type: SchedulableTriggerInputTypes.DATE, date };
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
