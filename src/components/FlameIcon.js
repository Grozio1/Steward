import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS } from '../constants/brand';

// Proper SVG flame path — teardrop with an asymmetric lean, classic flame silhouette
// Forest green circle background, Ember amber flame
export default function FlameIcon({ size = 28 }) {
  const containerSize = Math.round(size * 1.6);
  const s = containerSize; // viewBox size

  // Flame path centered in the viewBox
  // Drawn on a 100x100 grid, scaled via viewBox
  const flamePath = `
    M 50 88
    C 28 88 16 72 16 58
    C 16 44 26 36 34 28
    C 36 40 42 44 42 44
    C 42 34 46 18 50 12
    C 54 18 62 30 62 44
    C 62 44 68 40 70 28
    C 78 36 84 46 84 58
    C 84 72 72 88 50 88
    Z
  `;

  // Inner highlight — smaller teardrop, slightly right of center
  const innerPath = `
    M 50 76
    C 40 76 34 68 34 60
    C 34 54 38 50 42 46
    C 42 52 46 56 46 56
    C 48 50 50 44 52 40
    C 56 46 62 52 62 60
    C 62 68 60 76 50 76
    Z
  `;

  return (
    <View
      style={{
        width: containerSize,
        height: containerSize,
        borderRadius: containerSize / 2,
        backgroundColor: COLORS.forest,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg
        width={containerSize * 0.65}
        height={containerSize * 0.65}
        viewBox="0 0 100 100"
      >
        <Path d={flamePath} fill={COLORS.ember} />
        <Path d={innerPath} fill="#E8A85A" opacity="0.7" />
      </Svg>
    </View>
  );
}
