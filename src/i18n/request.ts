import { getRequestConfig } from "next-intl/server";
import { getLocalePreference } from "@/i18n/locale";
import en from "@/i18n/messages/en.json";
import hi from "@/i18n/messages/hi.json";

export default getRequestConfig(async () => {
  const { locale } = await getLocalePreference();
  return {
    locale,
    messages: locale === "hi" ? hi : en,
  };
});
