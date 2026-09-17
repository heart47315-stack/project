describe('map-web-safe fallback', () => {
  it('does not crash when react-native-maps is unavailable', () => {
    jest.resetModules();
    jest.doMock('react-native-maps', () => {
      throw new Error('react-native-maps unavailable');
    }, { virtual: true });

    const { MapView, Marker, Polyline } = require('../src/lib/map-web-safe');

    expect(typeof MapView).toBe('function');
    expect(typeof Marker).toBe('function');
    expect(typeof Polyline).toBe('function');
    expect(() => MapView({ initialRegion: { latitude: 13.7563, longitude: 100.5018 } })).not.toThrow();
    expect(() => Marker({ coordinate: { latitude: 13.7563, longitude: 100.5018 } })).not.toThrow();
    expect(() => Polyline({ coordinates: [{ latitude: 13.7563, longitude: 100.5018 }] })).not.toThrow();
  });
});
