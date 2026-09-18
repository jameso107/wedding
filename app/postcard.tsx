"use client";

import Image from "next/image";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import bayPointe from "../public/images/bay-pointe.jpg";
import { Postmark } from "./postmark";

const tiltSpring = { stiffness: 220, damping: 28, mass: 0.8 };
const flipSpring = { stiffness: 170, damping: 20, mass: 1.05 };
const pressSpring = { stiffness: 420, damping: 32, mass: 0.6 };

const cueTransition = {
  duration: 2.2,
  repeat: Infinity,
  ease: [0.45, 0, 0.2, 1] as const,
};

export function Postcard() {
  const reduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef({ x: 0, y: 0 });
  const [isFlipped, setIsFlipped] = useState(false);
  const [dragging, setDragging] = useState(false);

  const flip = useMotionValue(0);
  const flipS = useSpring(flip, flipSpring);
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const tiltXS = useSpring(tiltX, tiltSpring);
  const tiltYS = useSpring(tiltY, tiltSpring);
  const press = useMotionValue(1);
  const pressS = useSpring(press, pressSpring);

  const rotateY = useTransform([flipS, tiltYS], ([f, t]) => Number(f) + Number(t));

  function toggleFlip() {
    const next = isFlipped ? 0 : 180;
    flip.set(next);
    setIsFlipped(!isFlipped);
  }

  function resetTilt() {
    tiltX.set(0);
    tiltY.set(0);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    pointerStart.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    press.set(0.985);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (reduceMotion) return;
    const node = cardRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    const dir = isFlipped ? -1 : 1;
    tiltY.set(px * 11 * dir);
    tiltX.set(py * -7);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    press.set(1);
    setDragging(false);
    const target = event.target as HTMLElement | null;
    if (target?.closest("a")) {
      resetTilt();
      return;
    }
    const dx = event.clientX - pointerStart.current.x;
    const dy = event.clientY - pointerStart.current.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 12) {
      toggleFlip();
    }
    resetTilt();
  }

  return (
    <div className="stage">
      <button type="button" className="visually-hidden" onClick={toggleFlip}>
        {isFlipped
          ? "Show the painting side of the postcard"
          : "Flip the postcard to read the save the date"}
      </button>
      <motion.div
        ref={cardRef}
        className="card"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          press.set(1);
          setDragging(false);
          resetTilt();
        }}
        onPointerLeave={resetTilt}
        style={{
          rotateX: reduceMotion ? 0 : tiltXS,
          rotateY: reduceMotion ? (isFlipped ? 180 : 0) : rotateY,
          scale: pressS,
          cursor: dragging ? "grabbing" : "grab",
        }}
      >
        <div className="face face-front linen">
          <div className="photo-frame">
            <Image
              src={bayPointe}
              alt="Watercolor of Bay Pointe Inn on Gun Lake, with the inn, lawns, and docks along the water."
              fill
              priority
              sizes="100vw"
              placeholder="blur"
              className="photo"
            />
            <p className="caption">Gun Lake, Michigan</p>
            <div className="stamp">
              <Postmark />
            </div>
            <h1 className="names">
              <span>Hannah</span>
              <span className="second">
                <span className="plus">+</span>
                <span>James</span>
              </span>
            </h1>
            {!isFlipped ? (
              <div className="flip-cue" aria-hidden="true">
                <motion.p
                  className="flip-label"
                  animate={reduceMotion ? { opacity: 1 } : { opacity: [0.8, 1, 0.8] }}
                  transition={cueTransition}
                >
                  click to flip
                </motion.p>
                <motion.span
                  className="dog-ear"
                  animate={
                    reduceMotion
                      ? { y: 0 }
                      : { y: [0, -7, 0], rotate: [0, -7, 0] }
                  }
                  transition={cueTransition}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="face face-back linen">
          <div className="verso">
            <p className="letter">
              Sunday
              <br />
              July 4, 2027
              <br />
              <br />
              Please save the date.
              <br />
              <br />
              Hannah and James
              <br />
              are getting married
              <br />
              at Bay Pointe Inn
              <br />
              on Gun Lake.
            </p>
            <div className="address">
              <p className="to">The Oosterhouse Wedding</p>
              <p>Shelbyville, Michigan</p>
              <p className="url">oosterhouse.wedding</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
