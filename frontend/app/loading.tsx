"use client";

import BookLoader from "@/components/ui/BookLoader";

export default function GlobalLoading() {
  return (
    <div className="flex bg-slate-50/40 items-center justify-center min-h-[70vh] w-full h-full">
      <BookLoader size={80} message="Carregando..." />
    </div>
  );
}
