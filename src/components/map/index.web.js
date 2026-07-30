// Web implementation of the small react-native-maps surface this app uses,
// on the Google Maps JavaScript API. Covers exactly what the two map screens
// need: MapView (initialRegion, ref.animateToRegion, ref.fitToCoordinates),
// Marker (coordinate, custom children rendered via OverlayView, onPress,
// default pin when no children), Polyline.
//
// Key: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (inlined at export time). Without a
// key this renders a quiet placeholder and the screens stay fully usable —
// the map is enhancement, not a dependency (flag-don't-stub: the key is a
// human-created credential, see CREDENTIALS.md).
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { createPortal } from "react-dom";

const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
export const MAP_PROVIDER = undefined; // web ignores the provider prop

const MapCtx = React.createContext(null);

let loaderPromise = null;
function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&loading=async`;
    s.async = true;
    s.onload = () => {
      // With loading=async the namespace may attach a tick later.
      const poll = () =>
        window.google?.maps ? resolve(window.google.maps) : setTimeout(poll, 25);
      poll();
    };
    s.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

const zoomFromDelta = (latitudeDelta) =>
  Math.max(3, Math.min(20, Math.round(Math.log2(360 / (latitudeDelta || 0.05)))));

const MapView = React.forwardRef(function MapView(
  { style, initialRegion, children, provider: _provider, showsUserLocation: _u, ...rest },
  ref
) {
  const divRef = React.useRef(null);
  const [map, setMap] = React.useState(null);
  const [failed, setFailed] = React.useState(!KEY);

  React.useEffect(() => {
    if (!KEY || !divRef.current) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled) return;
        const m = new maps.Map(divRef.current, {
          center: initialRegion
            ? { lat: initialRegion.latitude, lng: initialRegion.longitude }
            : { lat: 3.139, lng: 101.6869 },
          zoom: initialRegion ? zoomFromDelta(initialRegion.latitudeDelta) : 11,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });
        setMap(m);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      animateToRegion(region) {
        if (!map) return;
        map.panTo({ lat: region.latitude, lng: region.longitude });
        if (region.latitudeDelta) map.setZoom(zoomFromDelta(region.latitudeDelta));
      },
      fitToCoordinates(coords, opts = {}) {
        if (!map || !coords?.length || !window.google?.maps) return;
        const bounds = new window.google.maps.LatLngBounds();
        coords.forEach((c) => bounds.extend({ lat: c.latitude, lng: c.longitude }));
        const p = opts.edgePadding || {};
        map.fitBounds(bounds, {
          top: p.top ?? 40, bottom: p.bottom ?? 40, left: p.left ?? 40, right: p.right ?? 40,
        });
      },
    }),
    [map]
  );

  return (
    <View style={style} {...rest}>
      {failed ? (
        <View style={s.placeholder}>
          <Text style={s.placeholderT}>
            {KEY ? "Map couldn't load" : "Map unavailable on web — list below works normally"}
          </Text>
        </View>
      ) : (
        <div ref={divRef} style={{ position: "absolute", inset: 0 }} />
      )}
      <MapCtx.Provider value={map}>{map ? children : null}</MapCtx.Provider>
    </View>
  );
});

export default MapView;

export function Marker({ coordinate, children, onPress, anchor, title, pinColor: _p }) {
  const map = React.useContext(MapCtx);
  const [container, setContainer] = React.useState(null);
  const hasChildren = React.Children.count(children) > 0;
  const onPressRef = React.useRef(onPress);
  onPressRef.current = onPress;

  React.useEffect(() => {
    if (!map || !window.google?.maps) return;
    const maps = window.google.maps;

    if (!hasChildren) {
      const m = new maps.Marker({
        map,
        position: { lat: coordinate.latitude, lng: coordinate.longitude },
        title,
      });
      const l = m.addListener("click", () => onPressRef.current?.());
      return () => { l.remove(); m.setMap(null); };
    }

    // Custom-view marker: an OverlayView whose div hosts the RN children
    // (rendered into it from below via createPortal).
    const overlay = new maps.OverlayView();
    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.cursor = "pointer";
    div.addEventListener("click", (e) => { e.stopPropagation(); onPressRef.current?.(); });
    overlay.onAdd = function () {
      this.getPanes().overlayMouseTarget.appendChild(div);
      setContainer(div);
    };
    overlay.draw = function () {
      const proj = this.getProjection();
      if (!proj) return;
      const pt = proj.fromLatLngToDivPixel(
        new maps.LatLng(coordinate.latitude, coordinate.longitude)
      );
      if (!pt) return;
      const ax = anchor?.x ?? 0.5;
      const ay = anchor?.y ?? 1;
      div.style.left = `${pt.x}px`;
      div.style.top = `${pt.y}px`;
      div.style.transform = `translate(-${ax * 100}%, -${ay * 100}%)`;
    };
    overlay.onRemove = function () {
      div.remove();
      setContainer(null);
    };
    overlay.setMap(map);
    return () => overlay.setMap(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, coordinate.latitude, coordinate.longitude, hasChildren]);

  if (!hasChildren || !container) return null;
  return createPortal(<View>{children}</View>, container);
}

export function Polyline({ coordinates, strokeColor, strokeWidth }) {
  const map = React.useContext(MapCtx);
  React.useEffect(() => {
    if (!map || !window.google?.maps || !coordinates?.length) return;
    const line = new window.google.maps.Polyline({
      map,
      path: coordinates.map((c) => ({ lat: c.latitude, lng: c.longitude })),
      strokeColor,
      strokeWeight: strokeWidth ?? 3,
    });
    return () => line.setMap(null);
  }, [map, JSON.stringify(coordinates), strokeColor, strokeWidth]);
  return null;
}

const s = StyleSheet.create({
  placeholder: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center", backgroundColor: "#e8eef0",
  },
  placeholderT: { fontSize: 13, color: "#5b6b73", textAlign: "center", padding: 20 },
});
