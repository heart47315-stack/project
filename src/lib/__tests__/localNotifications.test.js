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
  });

  it('exports the permission and Android channel APIs as functions', () => {
    expect(typeof Notifications.getPermissionsAsync).toBe('function');
    expect(typeof Notifications.requestPermissionsAsync).toBe('function');
    expect(typeof Notifications.setAndroidNotificationChannel).toBe('function');
  });
});
