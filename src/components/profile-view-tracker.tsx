"use client";

import { useEffect, useRef } from "react";
import { recordProfileViewAction } from "@/app/actions";

export function ProfileViewTracker({ profileUserId }: { profileUserId: string }) {
  const hasRecordedViewRef = useRef(false);

  useEffect(() => {
    if (hasRecordedViewRef.current) return;
    hasRecordedViewRef.current = true;

    void recordProfileViewAction(profileUserId).catch(() => {
      // Ignore analytics errors in UI flow
    });
  }, [profileUserId]);

  return null;
}
