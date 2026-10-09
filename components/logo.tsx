import Image from "next/image";
import logo from "@/public/logo.png";

export function Logo({ className }: { className?: string }) {
  return <Image src={logo} alt="" className={className} priority />;
}
