"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import Link from "next/link";

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const [user, setUser] = useState<any>(null);

  // ✅ Get token from cookie
  const getToken = () => {
    const match = document.cookie.match(/(^| )token=([^;]+)/);
    return match ? match[2] : null;
  };

  // ✅ Fetch user
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

        if (res.ok) {
          setUser(data);
        }
      } catch (err) {
        console.error("User fetch error:", err);
      }
    };

    fetchUser();
  }, []);

  function toggleDropdown(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }

  function handleLogout() {
    document.cookie =
      "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/signin");
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  // ✅ Fallbacks
  const userName = user?.name || "Guest User";
  const userEmail = user?.email || "guest@email.com";
  const userImage = user?.image
    ? user.image
    : "/images/user/owner.jpg"; // 👈 default image

  return (
    <div className="relative">
      {/* Toggle */}
      <button
        onClick={toggleDropdown}
        className="flex items-center text-gray-700"
      >
        <span className="mr-3 overflow-hidden rounded-full h-11 w-11">
          <Image
            width={44}
            height={44}
            src={userImage}
            alt="User"
          />
        </span>

        <span className="mr-1 font-medium text-theme-sm">
          {userName}
        </span>
      </button>

      {/* Dropdown */}
      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] w-[260px] p-3 bg-white rounded-2xl shadow"
      >
        {/* User Info */}
        <div>
          <span className="block font-medium text-gray-700">
            {userName}
          </span>
          <span className="block text-gray-500 text-sm">
            {userEmail}
          </span>
        </div>

        {/* Links */}
        <ul className="pt-4 pb-3 border-b">
          <li>
            <DropdownItem onClick={() => {
              closeDropdown();
              router.push("/profile");
            }}>
              Edit profile
            </DropdownItem>
          </li>

          <li>
            <DropdownItem href="/settings" onItemClick={closeDropdown}>
              Account settings
            </DropdownItem>
          </li>
        </ul>

        {/* Logout */}
        <button
          onClick={() => {
            closeDropdown();
            handleLogout();
          }}
          className="w-full text-left mt-3"
        >
          Sign out
        </button>
      </Dropdown>
    </div>
  );
}