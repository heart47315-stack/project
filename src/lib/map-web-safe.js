import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

const isWeb = Platform.OS === 'web';

let MapView;
let Marker;
let Polyline;

if (isWeb) {
  const ReactLeaflet = require('react-leaflet');
  const L = require('leaflet');

  // โหลด Leaflet CSS สำหรับเว็บ
  if (typeof document !== 'undefined') {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }

  const {
    MapContainer,
    TileLayer,
    CircleMarker,
    Polyline: LeafletPolyline,
    useMap,
  } = ReactLeaflet;

  /**
   * แปลง React Native region
   * เป็น center + zoom ของ Leaflet
   */
  function getCenter(region) {
    if (
      region &&
      Number.isFinite(Number(region.latitude)) &&
      Number.isFinite(Number(region.longitude))
    ) {
      return [
        Number(region.latitude),
        Number(region.longitude),
      ];
    }

    return [13.7563, 100.5018]; // Bangkok
  }

  function getZoom(region) {
    const latitudeDelta = Number(region?.latitudeDelta);

    if (!Number.isFinite(latitudeDelta)) {
      return 13;
    }

    if (latitudeDelta > 2) return 7;
    if (latitudeDelta > 1) return 8;
    if (latitudeDelta > 0.5) return 9;
    if (latitudeDelta > 0.2) return 11;
    if (latitudeDelta > 0.1) return 12;
    if (latitudeDelta > 0.05) return 13;
    if (latitudeDelta > 0.02) return 14;

    return 15;
  }

  /**
   * ทำให้ region ที่เปลี่ยนใน App.js
   * ขยับแผนที่ Leaflet ตามด้วย
   */
  function RegionUpdater({ region }) {
    const map = useMap();

    useEffect(() => {
      const center = getCenter(region);
      const zoom = getZoom(region);

      map.setView(center, zoom, {
        animate: false,
      });
    }, [
      map,
      region?.latitude,
      region?.longitude,
      region?.latitudeDelta,
      region?.longitudeDelta,
    ]);

    return null;
  }

  /**
   * MapView สำหรับ Web
   */
  MapView = function WebMapView({
    style,
    children,
    initialRegion,
    region,
  }) {
    const activeRegion = region || initialRegion;

    const center = getCenter(activeRegion);
    const zoom = getZoom(activeRegion);

    const mapStyle = {
      width: '100%',
      height: '100%',
      minHeight: 300,
      borderRadius: 16,
      overflow: 'hidden',
      ...StyleSheetLike(style),
    };

    return (
      <View style={style}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={mapStyle}
          scrollWheelZoom={true}
          zoomControl={true}
          attributionControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          <RegionUpdater region={activeRegion} />

          {children}
        </MapContainer>
      </View>
    );
  };

  /**
   * Marker สำหรับ Web
   *
   * ใช้ CircleMarker เพื่อไม่ต้องพึ่ง
   * icon image ของ Leaflet
   */
  Marker = function WebMarker({
    coordinate,
  }) {
    if (
      !coordinate ||
      !Number.isFinite(Number(coordinate.latitude)) ||
      !Number.isFinite(Number(coordinate.longitude))
    ) {
      return null;
    }

    return (
      <CircleMarker
        center={[
          Number(coordinate.latitude),
          Number(coordinate.longitude),
        ]}
        radius={9}
        pathOptions={{
          color: '#2F6FED',
          fillColor: '#2F6FED',
          fillOpacity: 0.9,
          weight: 3,
        }}
      />
    );
  };

  /**
   * Polyline สำหรับ Web
   */
  Polyline = function WebPolyline({
    coordinates = [],
    strokeColor = '#2F6FED',
    strokeWidth = 4,
  }) {
    const positions = coordinates
      .filter(
        (point) =>
          point &&
          Number.isFinite(Number(point.latitude)) &&
          Number.isFinite(Number(point.longitude))
      )
      .map((point) => [
        Number(point.latitude),
        Number(point.longitude),
      ]);

    if (positions.length < 2) {
      return null;
    }

    return (
      <LeafletPolyline
        positions={positions}
        pathOptions={{
          color: strokeColor,
          weight: strokeWidth,
          opacity: 0.85,
        }}
      />
    );
  };
} else {
  /**
   * Android / iOS
   * ใช้ react-native-maps ตามเดิม
   */
  const RNMaps = require('react-native-maps');

  MapView = RNMaps.default;
  Marker = RNMaps.Marker;
  Polyline = RNMaps.Polyline;
}

/**
 * React Native style → web-safe style
 */
function StyleSheetLike(style) {
  if (!style) return {};

  if (Array.isArray(style)) {
    return Object.assign(
      {},
      ...style.filter(Boolean).map(StyleSheetLike)
    );
  }

  const result = { ...style };

  // React Native บางค่าไม่เหมาะกับ CSS web
  delete result.flex;

  return result;
}

export { MapView, Marker, Polyline };