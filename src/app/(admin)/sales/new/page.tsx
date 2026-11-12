"use client";
import { Suspense } from "react";
import { DocForm } from "@/components/sb/Docs";
export default function Page() { return <Suspense><DocForm kind="sale" /></Suspense>; }
