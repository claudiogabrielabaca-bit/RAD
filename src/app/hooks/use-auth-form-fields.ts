import { useState } from "react";

export function useAuthFormFields(initialEmail = "") {
  const [email, setEmail] = useState(initialEmail);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return {
    email,
    setEmail,
    username,
    setUsername,
    password,
    setPassword,
    code,
    setCode,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
  };
}
