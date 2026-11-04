import * as Notifications from '../localNotifications';

describe('supportsAndroidNotificationChannels', () => {
  it('only enables notification channels on Android API 26 and newer', () => {
    expect(Notifications.supportsAndroidNotificationChannels({ OS: 'android', Version: 26 })).toBe(true);
    expect(Notifications.supportsAndroidNotificationChannels({ OS: 'android', Version: '35' })).toBe(true);
    expect(Notifications.supportsAndroidNotificationChannels({ OS: 'android', Version: 25 })).toBe(false);
    expect(Notifications.supportsAndroidNotificationChannels({ OS: 'ios', Version: 18 })).toBe(false);
    expect(Notifications.supportsAndroidNotificationChannels({ OS: 'web', Version: 0 })).toBe(false);
  });
});

describe('notification API bindings', () => {
  it('exports the scheduled-notification APIs as functions', () => {
    expect(typeof Notifications.getAllScheduledNotificationsAsync).toBe('function');
    expect(typeof Notifications.scheduleNotificationAsync).toBe('function');
    expect(typeof Notifications.cancelScheduledNotificationAsync).toBe('function');
    expect(typeof Notifications.getLastNotificationResponseAsync).toBe('function');
    expect(typeof Notifications.addNotificationResponseListener).toBe('function');
  });

  it('exports the permission and Android channel APIs as functions', () => {
    expect(typeof Notifications.getPermissionsAsync).toBe('function');
    expect(typeof Notifications.requestPermissionsAsync).toBe('function');
    expect(typeof Notifications.setAndroidNotificationChannel).toBe('function');
    expect(typeof Notifications.isNotificationChannelSoundEnabled).toBe('function');
  });
});

describe('notification scheduling helpers', () => {
  it('uses the new Android channel and keeps the legacy channel untouched', () => {
    expect(Notifications.NOTIFICATION_CHANNEL_ID).toBe('medsafe-reminders-v2');
    expect(Notifications.LEGACY_NOTIFICATION_CHANNEL_ID).toBe('reminders');
    expect(Notifications.ANDROID_NOTIFICATION_CHANNEL.sound).toBe('default');
    expect(Notifications.ANDROID_NOTIFICATION_CHANNEL.enableVibrate).toBe(true);
    expect(Notifications.ANDROID_NOTIFICATION_CHANNEL.importance).toBe(
      Notifications.AndroidImportance.HIGH
    );
  });

  it('parses Thailand local date/time without UTC conversion', () => {
    const value = Notifications.parseLocalDateTime('2026-11-05', '08:30');
    expect(value.getFullYear()).toBe(2026);
    expect(value.getMonth()).toBe(10);
    expect(value.getDate()).toBe(5);
    expect(value.getHours()).toBe(8);
    expect(value.getMinutes()).toBe(30);
  });

  it('builds all supported repeat trigger types', () => {
    const date = Notifications.parseLocalDateTime('2026-11-05', '08:30');
    expect(Notifications.buildNotificationTrigger({ date, repeat: 'none' }).date).toBe(date);
    expect(Notifications.buildNotificationTrigger({ date, repeat: 'daily' }).hour).toBe(8);
    expect(Notifications.buildNotificationTrigger({ date, repeat: 'weekly' }).weekday).toBe(4);
    expect(Notifications.buildNotificationTrigger({ date, repeat: 'monthly' }).day).toBe(5);
  });
});
