"use client";
import { use } from "react";
import { PartyDetail } from "@/components/sb/Party";
export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <PartyDetail kind="customer" id={id} />; }
