import React from 'react';
import { Platform, View } from 'react-native';

const isWeb = Platform.OS === 'web';

let MapView;
let Marker;
let Polyline;

if (isWeb) {
  MapView = ({ style, children }) => (
    <View style={style}>
      {children}
    </View>
  );
  Marker = () => null;
  Polyline = () => null;
} else {
  const RNMaps = require('react-native-maps');
  MapView = RNMaps.default;
  Marker = RNMaps.Marker;
  Polyline = RNMaps.Polyline;
}

export { MapView, Marker, Polyline };
