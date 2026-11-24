import { AuthForm } from "../auth-form";
import { signup } from "../actions";
import { DemoCta } from "@/components/demo/demo-cta";

export default function SignupPage() {
  return (
    <div className="w-full max-w-sm">
      <AuthForm mode="signup" action={signup} />
      <DemoCta variant="subtle" />
    </div>
  );
}
