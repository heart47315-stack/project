import React, { useEffect, useRef } from 'react';
import { Platform, View, Text } from 'react-native';

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
    Tooltip,
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
    title,
    children,
  }) {
    if (
      !coordinate ||
      !Number.isFinite(Number(coordinate.latitude)) ||
      !Number.isFinite(Number(coordinate.longitude))
    ) {
      return null;
    }

    const markerColor = title === 'ปลายทาง' ? '#2DB77A' : '#2F6FED';

    return (
      <CircleMarker
        center={[
          Number(coordinate.latitude),
          Number(coordinate.longitude),
        ]}
        radius={title === 'ปลายทาง' ? 10 : 8}
        pathOptions={{
          color: markerColor,
          fillColor: markerColor,
          fillOpacity: 0.9,
          weight: 3,
        }}
      >
        {title ? (
          <Tooltip direction="top" offset={[0, -12]}>
            {title}
          </Tooltip>
        ) : null}
        {children}
      </CircleMarker>
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
   * ถ้า dependency ขาด/พัง ให้ fallback แบบปลอดภัยแทน
   */
  let RNMaps;
  try {
    RNMaps = require('react-native-maps');
  } catch (error) {
    console.warn('react-native-maps unavailable, using safe fallback map:', error);
    RNMaps = null;
  }

  if (RNMaps) {
    MapView = RNMaps.default;
    Marker = RNMaps.Marker;
    Polyline = RNMaps.Polyline;
  } else {
    MapView = function SafeFallbackMapView({ style, children }) {
      return (
        <View
          style={[
            {
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#EEF5FF',
              padding: 16,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#D6E6FF',
            },
            style,
          ]}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 320,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 18,
              alignItems: 'center',
              shadowColor: '#2F6FED',
              shadowOpacity: 0.08,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
              elevation: 4,
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                backgroundColor: '#DDEBFF',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <Text style={{ fontSize: 24 }}>📍</Text>
            </View>
            <Text style={{ color: '#18365F', fontWeight: '700', fontSize: 17, textAlign: 'center' }}>
              แผนที่ไม่พร้อมใช้งานชั่วคราว
            </Text>
            <Text style={{ color: '#4C698A', fontSize: 12, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
              ระบบกำลังประเมินเส้นทางและข้อมูลความปลอดภัยแบบออฟไลน์
            </Text>
          </View>
          {children}
        </View>
      );
    };

    Marker = function SafeFallbackMarker() {
      return null;
    };

    Polyline = function SafeFallbackPolyline() {
      return null;
    };
  }
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