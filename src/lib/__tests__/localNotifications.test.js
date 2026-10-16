import { supportsAndroidNotificationChannels } from '../localNotifications';

describe('supportsAndroidNotificationChannels', () => {
  it('only enables notification channels on Android API 26 and newer', () => {
    expect(supportsAndroidNotificationChannels({ OS: 'android', Version: 26 })).toBe(true);
    expect(supportsAndroidNotificationChannels({ OS: 'android', Version: '35' })).toBe(true);
    expect(supportsAndroidNotificationChannels({ OS: 'android', Version: 25 })).toBe(false);
    expect(supportsAndroidNotificationChannels({ OS: 'ios', Version: 18 })).toBe(false);
    expect(supportsAndroidNotificationChannels({ OS: 'web', Version: 0 })).toBe(false);
  });
});
