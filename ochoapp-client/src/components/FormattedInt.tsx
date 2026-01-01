"use client";

import { NumberFormatter } from "@/lib/formatters";
import { useEffect, useState } from "react";

interface FormattedIntProps {
  number: number;
}

export default function FormattedInt({number}:FormattedIntProps) {
  const [language, setLanguage] = useState<string>("en-US");

  useEffect(() => {
    setLanguage(navigator.language || "en-US");
  }, []);

  const numberFormatter = new NumberFormatter(number, language);

  const formattedNumber = number > 5000 ? numberFormatter.formatNumber() : number

  return <span>{formattedNumber}</span>
}
