import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, View } from 'react-native';

const isWeb = Platform.OS === 'web';

let MapView;
let Marker;
let Polyline;

if (!isWeb) {
  // ============================================================
  // ANDROID / IOS
  // ใช้ react-native-maps ตามปกติ แต่ต้องหลีกเลี่ยงการสแกน dependency
  // เฉพาะตอน build web ให้ Metro ไม่ได้เจอ native-only module
  // ============================================================

  const RNMaps = Function(
    'return require("react-native-maps");'
  )();

  MapView = RNMaps.default;
  Marker = RNMaps.Marker;
  Polyline = RNMaps.Polyline;
} else {
  // ============================================================
  // WEB
  // ใช้ Leaflet + OpenStreetMap
  // ============================================================

  const L = require('leaflet');

  // ------------------------------------------------------------
  // โหลด Leaflet CSS อัตโนมัติ
  // ไม่ต้อง import .css ซึ่งอาจกระทบ Native bundler
  // ------------------------------------------------------------

  const loadLeafletCSS = () => {
    if (typeof document === 'undefined') {
      return;
    }

    const cssId = 'medsafe-leaflet-css';

    if (document.getElementById(cssId)) {
      return;
    }

    const link = document.createElement('link');

    link.id = cssId;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.crossOrigin = '';

    document.head.appendChild(link);
  };

  // ------------------------------------------------------------
  // แปลง React Native style → Web style
  // ------------------------------------------------------------

  const flattenStyle = (style) => {
    if (!style) {
      return {};
    }

    if (Array.isArray(style)) {
      return Object.assign(
        {},
        ...style
          .filter(Boolean)
          .map(flattenStyle)
      );
    }

    return style;
  };

  // ------------------------------------------------------------
  // Region → Leaflet center
  // ------------------------------------------------------------

  const getCenter = (region) => {
    const latitude = Number(region?.latitude);
    const longitude = Number(region?.longitude);

    return [
      Number.isFinite(latitude) ? latitude : 13.7563,
      Number.isFinite(longitude) ? longitude : 100.5018,
    ];
  };

  // ------------------------------------------------------------
  // latitudeDelta → zoom
  // ------------------------------------------------------------

  const getZoom = (region) => {
    const latitudeDelta = Number(
      region?.latitudeDelta
    );

    if (
      !Number.isFinite(latitudeDelta) ||
      latitudeDelta <= 0
    ) {
      return 14;
    }

    const zoom = Math.round(
      Math.log2(360 / latitudeDelta)
    );

    return Math.max(
      3,
      Math.min(19, zoom)
    );
  };

  // ------------------------------------------------------------
  // สร้าง Marker แบบวงกลม
  // ------------------------------------------------------------

  const createMarkerIcon = (color, size = 18) => {
    return L.divIcon({
      className: 'medsafe-leaflet-marker',
      html: `
        <div
          style="
            width:${size}px;
            height:${size}px;
            border-radius:50%;
            background:${color};
            border:3px solid #ffffff;
            box-shadow:0 2px 7px rgba(0,0,0,0.35);
            box-sizing:border-box;
          "
        ></div>
      `,
      iconSize: [size, size],
      iconAnchor: [
        size / 2,
        size / 2,
      ],
    });
  };

  // ------------------------------------------------------------
  // Marker
  //
  // App.js เดิมส่ง:
  //
  // <Marker coordinate={...}>
  //   <View>...</View>
  // </Marker>
  //
  // ดังนั้น Web จะอ่าน coordinate แล้วสร้าง
  // Leaflet marker โดยไม่จำเป็นต้องแก้ App.js
  // ------------------------------------------------------------

  Marker = ({ coordinate }) => {
    // Marker ตัวนี้จะถูกเก็บเป็นข้อมูลให้ MapView
    // ไม่ได้ render แผนที่เอง
    return null;
  };

  Marker.__mapType = 'marker';

  // ------------------------------------------------------------
  // Polyline
  // ------------------------------------------------------------

  Polyline = ({
    coordinates,
    strokeColor,
    strokeWidth,
  }) => {
    return null;
  };

  Polyline.__mapType = 'polyline';

  // ------------------------------------------------------------
  // MapView
  // ------------------------------------------------------------

  MapView = ({
    style,
    initialRegion,
    region,
    children,
  }) => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);

    const overlaysRef = useRef([]);

    const [mapReady, setMapReady] =
      useState(false);

    const [mapError, setMapError] =
      useState('');

    const flatStyle = useMemo(
      () => flattenStyle(style),
      [style]
    );

    // ----------------------------------------------------------
    // อ่าน Marker และ Polyline จาก children
    // ----------------------------------------------------------

    const mapItems = useMemo(() => {
      const markers = [];
      const polylines = [];

      React.Children.forEach(
        children,
        (child) => {
          if (
            !React.isValidElement(child)
          ) {
            return;
          }

          const type =
            child.type?.__mapType;

          if (type === 'marker') {
            markers.push(
              child.props || {}
            );
          }

          if (type === 'polyline') {
            polylines.push(
              child.props || {}
            );
          }
        }
      );

      return {
        markers,
        polylines,
      };
    }, [children]);

    // ----------------------------------------------------------
    // สร้าง Map ครั้งแรก
    // ----------------------------------------------------------

    useEffect(() => {
      loadLeafletCSS();

      if (
        typeof window === 'undefined' ||
        !mapContainerRef.current
      ) {
        return undefined;
      }

      if (mapRef.current) {
        return undefined;
      }

      try {
        const activeRegion =
          region || initialRegion;

        const center =
          getCenter(activeRegion);

        const zoom =
          getZoom(activeRegion);

        const map = L.map(
          mapContainerRef.current,
          {
            center,
            zoom,
            zoomControl: true,
            attributionControl: true,
            scrollWheelZoom: true,
            dragging: true,
            doubleClickZoom: true,
            touchZoom: true,
          }
        );

        // ------------------------------------------------------
        // OpenStreetMap
        // ------------------------------------------------------

        L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            maxZoom: 19,
            attribution:
              '&copy; OpenStreetMap contributors',
          }
        ).addTo(map);

        mapRef.current = map;

        setMapReady(true);

        // ------------------------------------------------------
        // Leaflet ต้องการ invalidateSize หลัง DOM render
        // ------------------------------------------------------

        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 200);
      } catch (error) {
        console.error(
          'Leaflet initialization error:',
          error
        );

        setMapError(
          'ไม่สามารถเปิดแผนที่ได้'
        );
      }

      // --------------------------------------------------------
      // Cleanup
      // --------------------------------------------------------

      return () => {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        setMapReady(false);
      };
    }, []);

    // ----------------------------------------------------------
    // อัปเดตตำแหน่งกลางแผนที่
    // ----------------------------------------------------------

    useEffect(() => {
      if (!mapRef.current) {
        return;
      }

      const activeRegion =
        region || initialRegion;

      if (!activeRegion) {
        return;
      }

      const center =
        getCenter(activeRegion);

      const zoom =
        getZoom(activeRegion);

      mapRef.current.setView(
        center,
        zoom,
        {
          animate: false,
        }
      );

      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 100);
    }, [
      region,
      initialRegion,
    ]);

    // ----------------------------------------------------------
    // วาด Marker + Polyline
    // ----------------------------------------------------------

    useEffect(() => {
      if (
        !mapReady ||
        !mapRef.current
      ) {
        return;
      }

      const map =
        mapRef.current;

      // --------------------------------------------------------
      // ลบ overlay เดิม
      // --------------------------------------------------------

      overlaysRef.current.forEach(
        (overlay) => {
          try {
            map.removeLayer(
              overlay
            );
          } catch {
            // ignore
          }
        }
      );

      overlaysRef.current = [];

      // --------------------------------------------------------
      // Marker
      // --------------------------------------------------------

      mapItems.markers.forEach(
        (markerProps, index) => {
          const coordinate =
            markerProps?.coordinate;

          if (!coordinate) {
            return;
          }

          const latitude =
            Number(
              coordinate.latitude
            );

          const longitude =
            Number(
              coordinate.longitude
            );

          if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
          ) {
            return;
          }

          // Marker แรก = ตำแหน่งปัจจุบัน
          const isCurrentLocation =
            index === 0;

          const markerColor =
            isCurrentLocation
              ? '#E95454'
              : '#2DB77A';

          const markerSize =
            isCurrentLocation
              ? 20
              : 18;

          const marker =
            L.marker(
              [
                latitude,
                longitude,
              ],
              {
                icon:
                  createMarkerIcon(
                    markerColor,
                    markerSize
                  ),
                title:
                  isCurrentLocation
                    ? 'ตำแหน่งปัจจุบัน'
                    : 'จุดหมายปลายทาง',
              }
            );

          marker.addTo(map);

          // ----------------------------------------------------
          // Tooltip
          // ----------------------------------------------------

          marker.bindTooltip(
            isCurrentLocation
              ? '📍 ตำแหน่งปัจจุบัน'
              : '📌 จุดหมายปลายทาง',
            {
              direction: 'top',
              offset: [0, -8],
            }
          );

          overlaysRef.current.push(
            marker
          );
        }
      );

      // --------------------------------------------------------
      // Polyline
      // --------------------------------------------------------

      mapItems.polylines.forEach(
        (polylineProps) => {
          const coordinates =
            Array.isArray(
              polylineProps?.coordinates
            )
              ? polylineProps.coordinates
              : [];

          if (
            coordinates.length < 2
          ) {
            return;
          }

          const path =
            coordinates
              .map((point) => {
                const latitude =
                  Number(
                    point?.latitude
                  );

                const longitude =
                  Number(
                    point?.longitude
                  );

                if (
                  !Number.isFinite(
                    latitude
                  ) ||
                  !Number.isFinite(
                    longitude
                  )
                ) {
                  return null;
                }

                return [
                  latitude,
                  longitude,
                ];
              })
              .filter(Boolean);

          if (path.length < 2) {
            return;
          }

          const line =
            L.polyline(
              path,
              {
                color:
                  polylineProps
                    ?.strokeColor ||
                  '#2F6FED',

                weight:
                  Number(
                    polylineProps
                      ?.strokeWidth
                  ) || 4,

                opacity: 0.95,

                lineCap: 'round',

                lineJoin: 'round',
              }
            );

          line.addTo(map);

          overlaysRef.current.push(
            line
          );
        }
      );

      // --------------------------------------------------------
      // ปรับขนาดแผนที่
      // --------------------------------------------------------

      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 100);
    }, [
      mapReady,
      mapItems,
    ]);

    // ----------------------------------------------------------
    // Style
    // ----------------------------------------------------------

    const width =
      flatStyle?.width ||
      '100%';

    const height =
      flatStyle?.height ||
      230;

    const containerStyle = {
      width,
      height,
      position: 'relative',
      overflow: 'hidden',
      borderRadius:
        flatStyle?.borderRadius ||
        0,
      backgroundColor:
        '#EAF2FF',
    };

    // ----------------------------------------------------------
    // Render
    // ----------------------------------------------------------

    return (
      <View
        style={containerStyle}
      >
        <div
          ref={mapContainerRef}
          style={{
            width: '100%',
            height: '100%',
            minHeight:
              typeof height ===
              'number'
                ? `${height}px`
                : height,
            position: 'relative',
            zIndex: 1,
          }}
        />

        {mapError ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              display: 'flex',
              alignItems:
                'center',
              justifyContent:
                'center',
              padding: 20,
              background:
                '#EEF4FF',
              color:
                '#18365F',
              fontFamily:
                'sans-serif',
              fontSize: 14,
              textAlign:
                'center',
            }}
          >
            {mapError}
          </div>
        ) : null}
      </View>
    );
  };

  MapView.__mapType =
    'map';
}

export {
  MapView,
  Marker,
  Polyline,
};