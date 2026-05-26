import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';

const RETTRACK_LOGO_MARK = require('../../assets/rettrack-logo-mark.png');

export function AppStartupSplash() {
  const { height, width } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const tileSize = Math.min(Math.max(shortestSide * 0.5, 190), 272);
  const markSize = tileSize * 0.56;
  const centerX = width / 2;
  const centerY = height / 2;
  const ambientGlowRx = Math.max(width * 1.02, shortestSide * 0.96);
  const ambientGlowRy = Math.max(height * 0.48, shortestSide * 0.88);
  const centerGlowRx = Math.max(width * 0.82, shortestSide * 0.78);
  const centerGlowRy = Math.max(height * 0.35, shortestSide * 0.68);
  const outerRingRx = Math.max(width * 1.16, shortestSide * 1.1);
  const outerRingRy = Math.max(height * 0.5, shortestSide * 0.98);
  const innerRingRx = Math.max(width * 0.82, shortestSide * 0.78);
  const innerRingRy = Math.max(height * 0.35, shortestSide * 0.66);
  const tileGlowRx = tileSize * 1.58;
  const tileGlowRy = tileSize * 1.32;
  const tileShadowWidth = tileSize * 1.08;
  const tileShadowHeight = tileSize * 0.14;

  return (
    <View style={styles.container}>
      <Svg
        height={height}
        pointerEvents="none"
        style={styles.backgroundSvg}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <Defs>
          <RadialGradient cx="50%" cy="50%" id="ambientGlow" r="50%">
            <Stop offset="0%" stopColor="#FFFDF7" stopOpacity={0.76} />
            <Stop offset="54%" stopColor="#F1DFC0" stopOpacity={0.2} />
            <Stop offset="100%" stopColor="#F8F4EA" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient cx="50%" cy="50%" id="centerGlow" r="50%">
            <Stop offset="0%" stopColor="#FFFFFB" stopOpacity={0.9} />
            <Stop offset="58%" stopColor="#FFF3DF" stopOpacity={0.32} />
            <Stop offset="100%" stopColor="#F8F4EA" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient cx="50%" cy="50%" id="tileGlow" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.58} />
            <Stop offset="64%" stopColor="#F2DFC0" stopOpacity={0.16} />
            <Stop offset="100%" stopColor="#F8F4EA" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect fill="#F8F4EA" height={height} width={width} x={0} y={0} />
        <Ellipse
          cx={centerX}
          cy={centerY + tileSize * 0.08}
          fill="url(#ambientGlow)"
          rx={ambientGlowRx}
          ry={ambientGlowRy}
        />
        <Ellipse
          cx={centerX}
          cy={centerY}
          fill="url(#centerGlow)"
          rx={centerGlowRx}
          ry={centerGlowRy}
        />
        <Ellipse
          cx={centerX}
          cy={centerY + tileSize * 0.1}
          fill="none"
          rx={outerRingRx}
          ry={outerRingRy}
          stroke="#D9C39A"
          strokeOpacity={0.105}
          strokeWidth={1.15}
        />
        <Ellipse
          cx={centerX}
          cy={centerY}
          fill="none"
          rx={innerRingRx}
          ry={innerRingRy}
          stroke="#FFF8EC"
          strokeOpacity={0.04}
          strokeWidth={1}
        />
        <Ellipse
          cx={centerX}
          cy={centerY + tileSize * 0.04}
          fill="url(#tileGlow)"
          rx={tileGlowRx}
          ry={tileGlowRy}
        />
      </Svg>
      <View
        pointerEvents="none"
        style={[
          styles.tileContactShadow,
          {
            borderRadius: tileShadowHeight / 2,
            height: tileShadowHeight,
            transform: [
              {
                translateY: tileSize * 0.45,
              },
            ],
            width: tileShadowWidth,
          },
        ]}
      />
      <View
        style={[
          styles.tileFrame,
          {
            borderRadius: tileSize * 0.18,
            height: tileSize,
            width: tileSize,
          },
        ]}
      >
        <View
          style={[
            styles.tileSurface,
            {
              borderRadius: tileSize * 0.18,
              height: tileSize,
              width: tileSize,
            },
          ]}
        >
          <View pointerEvents="none" style={styles.tileHighlight} />
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={RETTRACK_LOGO_MARK}
            style={{
              height: markSize,
              width: markSize,
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#F8F4EA',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  backgroundSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  tileContactShadow: {
    backgroundColor: 'rgba(132, 101, 63, 0.04)',
    position: 'absolute',
    shadowColor: '#80623E',
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 36,
  },
  tileFrame: {
    alignItems: 'center',
    elevation: 9,
    justifyContent: 'center',
    shadowColor: '#8B6D48',
    shadowOffset: {
      height: 18,
      width: 0,
    },
    shadowOpacity: 0.13,
    shadowRadius: 44,
  },
  tileSurface: {
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileHighlight: {
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    height: '46%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
