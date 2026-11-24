import { AuthForm } from "../auth-form";
import { login } from "../actions";
import { DemoCta } from "@/components/demo/demo-cta";

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      <AuthForm mode="login" action={login} />
      <DemoCta variant="subtle" />
    </div>
  );
}
