import type { Metadata } from "next";
import SiteHeader from "../SiteHeader";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <div className="narrow qwrap">
        <h1 className="q">Sign in to your workspace</h1>
        <p className="qhint">Use the email address you gave us. We will send a one-time code. There is no password.</p>
        <LoginForm />
      </div>
    </>
  );
}
