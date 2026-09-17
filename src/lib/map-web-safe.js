import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';

const isWeb = Platform.OS === 'web';

let MapView;
let Marker;
let Polyline;

/**
 * ---------------------------------------------------------
 * Shared helpers
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

  // React Native flex is handled by the outer RN View.
  // Leaflet itself should receive normal CSS sizing.
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
  // Bangkok fallback
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
 * Prevent </script> or HTML characters from breaking
 * the inline HTML generated for the native WebView.
 */
function safeJson(value) {
  return JSON.stringify(value ?? [])
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * ---------------------------------------------------------
 * WEB
 * Leaflet + OpenStreetMap
 * ---------------------------------------------------------
 */

if (isWeb) {
  const ReactLeaflet = require('react-leaflet');

  /*
   * Load Leaflet CSS once.
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
   * Update Leaflet map when App.js changes region.
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
   * Web MapView
   *
   * API-compatible enough for the existing App.js:
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
   * Web Marker
   *
   * React Native:
   * <Marker
   *   coordinate={{ latitude, longitude }}
   *   title="..."
   * />
   *
   * becomes Leaflet CircleMarker.
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
   * Web Polyline
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
 * Leaflet + OpenStreetMap inside WebView
 *
 * NO react-native-maps
 * NO Google Maps API
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
   * These are placeholders used while App.js creates
   * the children tree.
   *
   * They don't render directly.
   * NativeOsmMapView reads their props and converts them
   * to Leaflet objects inside the WebView.
   */
  Marker = function NativeOsmMarker() {
    return null;
  };

  Polyline = function NativeOsmPolyline() {
    return null;
  };

  /**
   * Extract markers and polylines from App.js children.
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
   * Generate the HTML document rendered inside
   * react-native-webview.
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
 * Create map
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
 * OpenStreetMap tiles
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
 * Markers
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
 * Route lines
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
 * Make sure Leaflet calculates the correct
 * WebView dimensions after loading.
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
   * This component keeps the same general API
   * expected by the existing App.js.
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
 * Exports
 * ---------------------------------------------------------
 */

export {
  MapView,
  Marker,
  Polyline,
};