"use client";
import { use } from "react";
import { PartyDetail } from "@/components/sb/Party";
export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <PartyDetail kind="supplier" id={id} />; }
