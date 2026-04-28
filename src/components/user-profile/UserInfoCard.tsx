"use client";

import React, { useEffect, useState } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Image from "next/image";

export default function UserInfoCard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { isOpen, openModal, closeModal } = useModal();

  const getToken = () => {
    const match = document.cookie.match(/(^| )token=([^;]+)/);
    return match ? match[2] : null;
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = getToken();
        if (!token) return;

        const res = await fetch(
          "http://smart-business-backend-stagging.test/api/user",
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        const data = await res.json();

        if (res.ok) setUser(data.data || data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  if (loading) return <p className="p-5">Loading...</p>;
  if (!user) return <p className="p-5">No user data found</p>;

  const [firstName, lastName] = user.name?.split(" ") || ["", ""];

  const assignments = user.assignments || [];
  const userImage = user?.image
    ? user.image
    : "/images/user/owner.jpg"; //
  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div className="mr-3 overflow-hidden rounded-full">
        <Image
          width={144}
          height={144}
          src={userImage}
          alt="User"
        />
      </div>
      {/* USER HEADER */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            {firstName} {lastName}
          </h2>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>

        {/* EDIT BUTTON */}
        <button
          onClick={openModal}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
        >
          <svg
            className="fill-current"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z"
              fill=""
            />
          </svg>
          Edit
        </button>

      </div>

      {/* COMPANY ACCESS */}
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
        Company Access
      </h3>

      <div className="space-y-6">

        {groupCompanies(assignments).map((company: any, idx: number) => (

          <div
            key={idx}
            className="border rounded-2xl p-5 bg-white dark:bg-gray-900 shadow-sm"
          >

            {/* COMPANY HEADER */}
            <div className="flex justify-between items-start mb-4">

              <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                🏢 {company.name}
              </h3>

              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-600">
                Active
              </span>

            </div>

            {/* BUSINESSES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

              {company.businesses.map((biz: any, i: number) => (

                <div
                  key={i}
                  className="p-4 rounded-xl border bg-gray-50 dark:bg-gray-800"
                >

                  <p className="text-sm font-medium text-gray-800 dark:text-white">
                    🏬 {biz.name}
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    Type: {biz.type || "branch"}
                  </p>

                  <p className="text-xs text-gray-500">
                    📍 {biz.address || "No address"}
                  </p>

                  <p className="text-xs text-gray-500">
                    Role: {biz.role}
                  </p>

                </div>

              ))}

            </div>

          </div>

        ))}

      </div>

      {/* EDIT MODAL (OLD STYLE - SIMPLE USER FIELDS ONLY) */}
      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
        <div className="relative w-full p-4 overflow-y-auto bg-white no-scrollbar rounded-3xl dark:bg-gray-900 lg:p-11">

          <h4 className="text-xl font-semibold mb-4">
            Edit User
          </h4>

          <div className="grid grid-cols-2 gap-4">

            <div>
              <Label>First Name</Label>
              <Input defaultValue={firstName} />
            </div>

            <div>
              <Label>Last Name</Label>
              <Input defaultValue={lastName} />
            </div>

            <div className="col-span-2">
              <Label>Email</Label>
              <Input defaultValue={user.email} />
            </div>

          </div>

          <div className="flex justify-end gap-2 mt-6">

            <Button variant="outline" onClick={closeModal}>
              Close
            </Button>

            <Button>
              Save
            </Button>

          </div>

        </div>

      </Modal>

    </div>
  );
}

/* 🔥 YOUR ORIGINAL GROUPING (FIXED TYPE ONLY) */
function groupCompanies(assignments: any[]) {
  const map: Record<string, any> = {};

  assignments.forEach((item: any) => {
    if (!item.company) return;

    if (!map[item.company]) {
      map[item.company] = {
        name: item.company,
        status: item.company_status ?? true,
        businesses: [],
      };
    }

    map[item.company].businesses.push({
      name: item.business,
      type: item.business_type,
      address: item.address,
      role: item.role,
      status: item.business_status ?? true,
    });
  });

  return Object.values(map);
}