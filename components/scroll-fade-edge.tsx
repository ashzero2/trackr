import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type ScrollFadeEdgeProps = {
  /** Background color to fade FROM (fully opaque) — should match the screen bg. */
  backgroundColor: string;
  /** Height of the scroll container to match. */
  height: number;
  /** Width of each fade edge in px. Default 24. */
  width?: number;
};

/**
 * Overlay left and right gradient fades on a horizontal scroll container.
 * Place this as a sibling *after* the ScrollView inside a shared parent View.
 * The parent must have `position: 'relative'` or no explicit positioning (default).
 */
export function ScrollFadeEdges({ backgroundColor, height, width = 24 }: ScrollFadeEdgeProps) {
  const transparent = 'rgba(0,0,0,0)';

  return (
    <>
      <LinearGradient
        colors={[backgroundColor, transparent]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        pointerEvents="none"
        style={[styles.edge, styles.left, { width, height }]}
      />
      <LinearGradient
        colors={[transparent, backgroundColor]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        pointerEvents="none"
        style={[styles.edge, styles.right, { width, height }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: 0,
    zIndex: 1,
  },
  left: {
    left: 0,
  },
  right: {
    right: 0,
  },
});