"use client";

import { useEffect, useRef } from "react";
import { recordPostViewAction } from "@/app/actions";

export function PostViewTracker({ postId }: { postId: string }) {
  const hasRecordedInitialViewRef = useRef(false);

  useEffect(() => {
    if (hasRecordedInitialViewRef.current) return;
    hasRecordedInitialViewRef.current = true;

    let sentLeaveEvent = false;
    const startMs = Date.now();

    void recordPostViewAction(postId).catch(() => {
      // Ignore analytics errors in UI flow
    });

    const sendDuration = () => {
      if (sentLeaveEvent) return;
      sentLeaveEvent = true;
      const elapsedSeconds = Math.max(0, Math.round((Date.now() - startMs) / 1000));
      void recordPostViewAction(postId, elapsedSeconds).catch(() => {
        // Ignore analytics errors in UI flow
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        sendDuration();
      }
    };

    const onBeforeUnload = () => {
      sendDuration();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      sendDuration();
    };
  }, [postId]);

  return null;
}
