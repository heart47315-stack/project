import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';

const isWeb = Platform.OS === 'web';

let MapView;
let Marker;
let Polyline;

/**
 * ---------------------------------------------------------
 * ตัวช่วยร่วมใช้
 * ---------------------------------------------------------
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

  // flex ของ React Native จะถูกจัดการโดย View ภายนอก
  // Leaflet ควรได้รับการปรับขนาด CSS แบบปกติ
  delete result.flex;

  return result;
}

function normalizeCoordinate(coordinate) {
  if (
    !coordinate ||
    !Number.isFinite(Number(coordinate.latitude)) ||
    !Number.isFinite(Number(coordinate.longitude))
  ) {
    return null;
  }

  return {
    latitude: Number(coordinate.latitude),
    longitude: Number(coordinate.longitude),
  };
}

function getDefaultCenter() {
  // ค่าเริ่มต้นสำรองสำหรับกรุงเทพฯ
  return [13.7563, 100.5018];
}

function getCenter(region) {
  const coordinate = normalizeCoordinate(region);

  if (coordinate) {
    return [
      coordinate.latitude,
      coordinate.longitude,
    ];
  }

  return getDefaultCenter();
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
 * ป้องกัน </script> หรืออักขระ HTML
 * ที่อาจทำลาย HTML แบบ inline ที่สร้างสำหรับ WebView บน native
 */
function safeJson(value) {
  return JSON.stringify(value ?? [])
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * ---------------------------------------------------------
 * เว็บ
 * Leaflet + OpenStreetMap
 * ---------------------------------------------------------
 */

if (isWeb) {
  const ReactLeaflet = require('react-leaflet');

  /*
   * โหลด Leaflet CSS ครั้งเดียว
   */
  if (typeof document !== 'undefined') {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');

      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href =
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

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
   * อัปเดตแผนที่ Leaflet เมื่อ App.js เปลี่ยน region
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
   * แผนที่สำหรับเว็บ
   *
   * เข้ากันได้กับ App.js ที่มีอยู่เพียงพอ:
   *
   * <MapView
   *   initialRegion={...}
   *   region={...}
   * >
   *   <Marker ... />
   *   <Polyline ... />
   * </MapView>
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
            maxZoom={19}
          />

          <RegionUpdater region={activeRegion} />

          {children}
        </MapContainer>
      </View>
    );
  };

  /**
   * Marker สำหรับเว็บ
   *
   * รีแอ็กต์ เนทีฟ:
   * <Marker
   *   coordinate={{ latitude, longitude }}
   *   title="..."
   * />
   *
   * จะกลายเป็น Leaflet CircleMarker
   */
  Marker = function WebMarker({
    coordinate,
    title,
  }) {
    const normalized = normalizeCoordinate(coordinate);

    if (!normalized) {
      return null;
    }

    const isDestination = title === 'ปลายทาง';

    const markerColor = isDestination
      ? '#2DB77A'
      : '#2F6FED';

    return (
      <CircleMarker
        center={[
          normalized.latitude,
          normalized.longitude,
        ]}
        radius={isDestination ? 10 : 8}
        pathOptions={{
          color: markerColor,
          fillColor: markerColor,
          fillOpacity: 0.9,
          weight: 3,
        }}
      >
        {title ? (
          <Tooltip
            direction="top"
            offset={[0, -12]}
          >
            {title}
          </Tooltip>
        ) : null}
      </CircleMarker>
    );
  };

  /**
   * Polyline สำหรับเว็บ
   */
  Polyline = function WebPolyline({
    coordinates = [],
    strokeColor = '#2F6FED',
    strokeWidth = 4,
  }) {
    const positions = coordinates
      .filter((point) => normalizeCoordinate(point))
      .map((point) => {
        const normalized =
          normalizeCoordinate(point);

        return [
          normalized.latitude,
          normalized.longitude,
        ];
      });

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
}

/**
 * ---------------------------------------------------------
 * ANDROID / IOS
 * Leaflet + OpenStreetMap ภายใน WebView
 *
 * ไม่มี react-native-maps
 * ไม่มี Google Maps API
 * ---------------------------------------------------------
 */

else {
  let WebView;

  try {
    ({ WebView } = require('react-native-webview'));
  } catch (error) {
    WebView = function WebViewFallback({ children, ...props }) {
      return <View {...props}>{children}</View>;
    };
  }

  /**
   * สิ่งนี้เป็น placeholder ที่ใช้ขณะ App.js
   * สร้างโครงสร้าง children
   *
   * ไม่ถูกเรนเดอร์โดยตรง
   * NativeOsmMapView จะอ่าน props ดังกล่าวแล้วแปลงเป็น
   * อ็อบเจ็กต์ Leaflet ภายใน WebView
   */
  Marker = function NativeOsmMarker() {
    return null;
  };

  Polyline = function NativeOsmPolyline() {
    return null;
  };

  /**
   * ดึง markers และ polylines จาก children ของ App.js
   */
  function collectMapData(children) {
    const markers = [];
    const polylines = [];

    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) {
        return;
      }

      /**
       * Marker
       */
      if (child.type === Marker) {
        const {
          coordinate,
          title,
        } = child.props || {};

        const normalized =
          normalizeCoordinate(coordinate);

        if (normalized) {
          markers.push({
            latitude: normalized.latitude,
            longitude: normalized.longitude,
            title: title || '',
          });
        }

        return;
      }

      /**
       * Polyline
       */
      if (child.type === Polyline) {
        const {
          coordinates = [],
          strokeColor = '#2F6FED',
          strokeWidth = 4,
        } = child.props || {};

        const normalizedCoordinates =
          coordinates
            .filter((point) =>
              normalizeCoordinate(point)
            )
            .map((point) =>
              normalizeCoordinate(point)
            );

        if (normalizedCoordinates.length >= 2) {
          polylines.push({
            coordinates:
              normalizedCoordinates,
            strokeColor,
            strokeWidth,
          });
        }

        return;
      }
    });

    return {
      markers,
      polylines,
    };
  }

  /**
   * สร้างเอกสาร HTML ที่ถูกเรนเดอร์ภายใน
   * react-native-webview
   */
  function createNativeOsmHtml(
    region,
    markers,
    polylines
  ) {
    const center = getCenter(region);
    const zoom = getZoom(region);

    return `
<!doctype html>

<html>
<head>

<meta
  charset="utf-8"
/>

<meta
  name="viewport"
  content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
/>

<title>MEDSAFE AI Map</title>

<link
  rel="stylesheet"
  href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
/>

<style>

html,
body,
#map {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  background: #EEF5FF;
}

body {
  overflow: hidden;
}

.leaflet-control-attribution {
  font-size: 9px;
}

.leaflet-control-zoom a {
  font-size: 20px;
}

</style>

</head>

<body>

<div id="map"></div>

<script
  src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js">
</script>

<script>

const initialCenter =
  ${safeJson(center)};

const initialZoom =
  ${zoom};

const markers =
  ${safeJson(markers)};

const polylines =
  ${safeJson(polylines)};

/**
 * สร้างแผนที่
 */
const map =
  L.map('map', {
    zoomControl: true,
    attributionControl: true,
    tap: true
  }).setView(
    initialCenter,
    initialZoom
  );

/**
 * ไทล์ OpenStreetMap
 */
L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    maxZoom: 19,
    attribution:
      '&copy; OpenStreetMap contributors'
  }
).addTo(map);

/**
 * ตัวทำเครื่องหมาย
 */
markers.forEach((item) => {

  const isDestination =
    item.title === 'ปลายทาง';

  const markerColor =
    isDestination
      ? '#2DB77A'
      : '#2F6FED';

  const marker =
    L.circleMarker(
      [
        item.latitude,
        item.longitude
      ],
      {
        radius:
          isDestination ? 10 : 8,

        color:
          markerColor,

        fillColor:
          markerColor,

        fillOpacity:
          0.9,

        weight:
          3
      }
    ).addTo(map);

  if (item.title) {
    marker.bindTooltip(
      item.title,
      {
        direction: 'top',
        offset: [0, -10]
      }
    );
  }
});

/**
 * เส้นทาง
 */
polylines.forEach((line) => {

  const points =
    line.coordinates.map(
      (point) => [
        point.latitude,
        point.longitude
      ]
    );

  if (points.length >= 2) {

    L.polyline(
      points,
      {
        color:
          line.strokeColor || '#2F6FED',

        weight:
          Number(line.strokeWidth) || 4,

        opacity:
          0.85
      }
    ).addTo(map);

  }

});

/**
 * ตรวจสอบให้แน่ใจว่า Leaflet คำนวณขนาดของ
 * WebView ให้ถูกต้องหลังจากโหลดเสร็จ
 */
setTimeout(() => {
  map.invalidateSize();
}, 300);

setTimeout(() => {
  map.invalidateSize();
}, 1000);

window.addEventListener(
  'resize',
  () => {
    map.invalidateSize();
  }
);

</script>

</body>
</html>
`;
  }

  /**
   * Native MapView
   *
   * คอมโพเนนต์นี้รักษา API ทั่วไปให้สอดคล้องกับ
   * App.js ที่มีอยู่เดิม
   */
  MapView = function NativeOsmMapView({
    style,
    children,
    initialRegion,
    region,
  }) {
    const activeRegion =
      region || initialRegion;

    const {
      markers,
      polylines,
    } = collectMapData(children);

    const html =
      createNativeOsmHtml(
        activeRegion,
        markers,
        polylines
      );

    return (
      <View
        style={[
          {
            flex: 1,
            overflow: 'hidden',
            borderRadius: 16,
          },
          style,
        ]}
      >
        <WebView
          originWhitelist={['*']}
          source={{
            html,
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          scrollEnabled={false}
          bounces={false}
          style={{
            flex: 1,
            backgroundColor: '#EEF5FF',
          }}
        />
      </View>
    );
  };
}

/**
 * ---------------------------------------------------------
 * ส่งออก
 * ---------------------------------------------------------
 */

export {
  MapView,
  Marker,
  Polyline,
};