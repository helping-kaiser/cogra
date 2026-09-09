"use client";

// `useLayoutEffect` on the client, `useEffect` on the server.
//
// Next prerenders client components, and React warns that a layout effect
// cannot run there — correctly, since there is nothing to measure. The branch
// is on the ENVIRONMENT, not on a render, so the hook order is the same every
// time either build runs.
//
// Anything that measures the DOM and corrects what is about to be painted
// wants this: the correction lands before the paint, and the uncorrected first
// frame — a chip cut against a width nobody has measured yet, a feed at the
// top of a list the reader was five pages down — never reaches the screen.

import { useEffect, useLayoutEffect } from "react";

export const useMeasureEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
