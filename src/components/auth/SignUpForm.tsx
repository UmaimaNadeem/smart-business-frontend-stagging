"use client";

import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignUpForm() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isChecked) {
      setError("Please accept terms & conditions");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        "http://smart-business-backend-stagging.test/api/register", // 👈 change if needed
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            password,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Signup failed");
        return;
      }

      // ✅ Optional: auto login after signup
      if (data.access_token) {
        document.cookie = `token=${data.access_token}; path=/;`;
        router.push("/");
      } else {
        router.push("/signin");
      }
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full overflow-y-auto no-scrollbar">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm">
              Sign Up
            </h1>
            <p className="text-sm text-gray-500">
              Enter your details to create account!
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-5">

              {/* NAME */}
              <div>
                <Label>Name *</Label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>

              {/* EMAIL */}
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>

              {/* PASSWORD */}
              <div>
                <Label>Password *</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 cursor-pointer"
                  >
                    {showPassword ? <EyeIcon /> : <EyeCloseIcon />}
                  </span>
                </div>
              </div>

              {/* ERROR */}
              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}

              {/* CHECKBOX */}
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isChecked}
                  onChange={setIsChecked}
                />
                <p className="text-sm">
                  Accept Terms & Conditions
                </p>
              </div>

              {/* BUTTON */}
              <div>
                <button
                  disabled={loading}
                  className="w-full px-4 py-3 text-sm text-white bg-brand-500 rounded-lg"
                >
                  {loading ? "Creating account..." : "Sign Up"}
                </button>
              </div>
            </div>
          </form>

          <div className="mt-5">
            <p className="text-sm text-center">
              Already have an account?{" "}
              <Link href="/signin" className="text-brand-500">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}