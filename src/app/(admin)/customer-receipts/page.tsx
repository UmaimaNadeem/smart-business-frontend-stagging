"use client";
import { Suspense } from "react";
import { PaymentsPage } from "@/components/sb/PaymentsPage";
export default function Page() { return <Suspense><PaymentsPage direction="in" /></Suspense>; }
