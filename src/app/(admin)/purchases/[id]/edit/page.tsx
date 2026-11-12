"use client";
import { Suspense, use } from "react";
import { DocForm } from "@/components/sb/Docs";
export default function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <Suspense><DocForm kind="purchase" id={id} /></Suspense>; }
