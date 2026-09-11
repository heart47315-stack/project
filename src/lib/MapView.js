import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';

const isWeb = Platform.OS === 'web';

let MapView;
let Marker;
let Polyline;

if (isWeb) {
  const { MapContainer, TileLayer, Marker: LeafletMarker, Polyline: LeafletPolyline } =
    require('react-leaflet');

  const L = require('leaflet');

  require('leaflet/dist/leaflet.css');

  // แก้ปัญหา icon ของ Leaflet
  delete L.Icon.Default.prototype._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });

  MapView = ({ style, initialRegion, children }) => {
    const center = initialRegion
      ? [
          initialRegion.latitude,
          initialRegion.longitude,
        ]
      : [13.7563, 100.5018];

    return (
      <View style={[styles.webMap, style]}>
        <MapContainer
          center={center}
          zoom={initialRegion?.latitude ? 15 : 12}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {children}
        </MapContainer>
      </View>
    );
  };

  Marker = ({ coordinate, title }) => {
    if (!coordinate) return null;

    return (
      <LeafletMarker
        position={[coordinate.latitude, coordinate.longitude]}
        title={title}
      />
    );
  };

  Polyline = ({ coordinates, ...props }) => {
    if (!coordinates || coordinates.length === 0) return null;

    return (
      <LeafletPolyline
        positions={coordinates.map((point) => [
          point.latitude,
          point.longitude,
        ])}
        {...props}
      />
    );
  };
} else {
  const RNMaps = require('react-native-maps');

  MapView = RNMaps.default;
  Marker = RNMaps.Marker;
  Polyline = RNMaps.Polyline;
}

const styles = StyleSheet.create({
  webMap: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
});

export { MapView, Marker, Polyline };