"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/api";
import { AuthForm } from "@/components/auth-form";
import { AppShell } from "@/components/app-shell";

export default function HomePage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(Boolean(getToken()));
  }, []);

  if (!authed) {
    return <AuthForm onAuthed={() => setAuthed(true)} />;
  }

  return <AppShell onSignOut={() => setAuthed(false)} />;
}
