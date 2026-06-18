"use client";

/* eslint-disable @next/next/no-img-element */
import type { ChatEmotion } from "@/features/chat/types";

type HarukoImageProps = {
  emotion?: ChatEmotion;
};

function getHarukoImage(emotion: string) {
  if (emotion === "joy") {
    return "/haruko/haruko_joy.png";
  }

  if (emotion === "sadness") {
    return "/haruko/haruko_sadness.png";
  }

  if (emotion === "fun") {
    return "/haruko/haruko_fun.png";
  }

  // TODO: 高校生がここを実装する angry
   if (emotion === "anger") {
     return "/haruko/haruko_angry.png";
   }

  return "/haruko/haruko.png";
}

export function HarukoImage({ emotion = "neutral" }: HarukoImageProps) {
  const imagePath = getHarukoImage(emotion);

  return (
    <img
      key={imagePath}
      src={imagePath}
      alt="HARUKO"
      data-emotion={emotion}
      data-image-path={imagePath}
      className="absolute inset-0 h-full w-full origin-top -translate-y-5 scale-90 object-contain object-top md:-translate-y-8 md:scale-[2.9]"
    />
  );
}
