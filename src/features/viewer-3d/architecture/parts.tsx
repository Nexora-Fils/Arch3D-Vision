"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { Matrix4, Quaternion, Vector3, type Material } from "three";
import { createMetricBox } from "@/features/viewer-3d/architecture/metric-box";

type Triple = [number, number, number];

interface MetricBoxProps {
  size: Triple;
  material: Material | Material[];
  position?: Triple;
  rotation?: Triple;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/** A box mesh with UVs in meters (see createMetricBox). */
export const MetricBox = ({ size, material, position, rotation, castShadow = false, receiveShadow = true }: MetricBoxProps) => {
  const [width, height, depth] = size;
  const geometry = useMemo(() => createMetricBox(width, height, depth), [width, height, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} position={position} rotation={rotation} castShadow={castShadow} receiveShadow={receiveShadow} />;
};

export interface Segment {
  start: Triple;
  end: Triple;
}

/**
 * Position and orientation of a part laid along a segment: local +x follows
 * the segment, local +y stays as close as possible to `up`.
 */
export const segmentFrame = (segment: Segment, up: Triple = [0, 1, 0]) => {
  const start = new Vector3(...segment.start);
  const end = new Vector3(...segment.end);
  const axis = new Vector3().subVectors(end, start);
  const length = axis.length();
  axis.normalize();
  const reference = new Vector3(...up);
  const side = new Vector3().crossVectors(axis, reference);
  if (side.lengthSq() < 1e-8) side.set(0, 0, 1);
  side.normalize();
  const normal = new Vector3().crossVectors(side, axis).normalize();
  const quaternion = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(axis, normal, side));
  const middle = start.add(end).multiplyScalar(0.5);
  return { position: middle.toArray() as Triple, quaternion, length };
};

interface AlongSegmentProps {
  segment: Segment;
  up?: Triple;
  children: ReactNode;
}

/** Places its children in the frame of a segment (x along it, centered on its middle). */
export const AlongSegment = ({ segment, up, children }: AlongSegmentProps) => {
  const frame = useMemo(() => segmentFrame(segment, up), [segment, up]);
  return (
    <group position={frame.position} quaternion={frame.quaternion}>
      {children}
    </group>
  );
};

export const segmentLength = (segment: Segment): number =>
  Math.hypot(segment.end[0] - segment.start[0], segment.end[1] - segment.start[1], segment.end[2] - segment.start[2]);
