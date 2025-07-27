"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  urls: string[];
  interval?: number;
  onFirstLoad?: () => void;
};

export default function Slideshow({
  urls,
  interval = 3000,
  onFirstLoad,
}: Props) {
  const [index, setIndex] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);


  useEffect(() => {
    const timer = setInterval(() => {

      setIndex((prev) => (prev + 1) % urls.length);
    }, interval);

    return () => clearInterval(timer);
  }, [urls.length, interval]);

  const handleLoad = () => {
    if (!hasLoaded) {
      setHasLoaded(true);
      onFirstLoad?.();
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence initial={false}>
        <motion.div
          key={urls[index]}
          className="absolute inset-0 w-full h-full"
          initial={{ y: -200, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 200, opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          <Image
            src={urls[index]}
            alt="スライド画像"
            fill
            className="object-contain"
            sizes="100vw"
            onLoad={handleLoad}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
