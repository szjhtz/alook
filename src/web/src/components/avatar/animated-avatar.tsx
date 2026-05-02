"use client";

import { useEffect, useRef, useState } from "react";
import { AvatarRenderer } from "./avatar-parts";
import type { AvatarConfig } from "./avatar-parts";

const ANIMATIONS = [
  "avatar-anim-shape-bounce",
  "avatar-anim-head-tilt",
  "avatar-anim-shake",
  "avatar-anim-wobble",
  "avatar-anim-pulse",
  "avatar-anim-spin",
  "avatar-anim-jelly",
  "avatar-anim-float",
  "avatar-anim-nod",
] as const;

interface AnimatedAvatarProps {
  config: AvatarConfig;
  size?: number;
  className?: string;
  isHovered: boolean;
}

export function AnimatedAvatar({ config, size, className, isHovered }: AnimatedAvatarProps) {
  const [animClass, setAnimClass] = useState<string | null>(null);
  const lastPickRef = useRef(-1);

  useEffect(() => {
    if (isHovered) {
      let idx = Math.floor(Math.random() * ANIMATIONS.length);
      if (idx === lastPickRef.current) idx = (idx + 1) % ANIMATIONS.length;
      lastPickRef.current = idx;
      setAnimClass(ANIMATIONS[idx]!);
    } else {
      setAnimClass(null);
    }
  }, [isHovered]);

  return (
    <div className={animClass ?? undefined}>
      <AvatarRenderer config={config} size={size} className={className} />
    </div>
  );
}
