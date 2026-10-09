import type { Locale } from "@/lib/i18n";
import { de } from "@/messages/de";
import { en, type Messages } from "@/messages/en";
import { es } from "@/messages/es";
import { fr } from "@/messages/fr";
import { pt } from "@/messages/pt";
import { sv } from "@/messages/sv";
import { uk } from "@/messages/uk";

const dictionaries = { en, sv, es, uk, fr, de, pt } satisfies Record<
  Locale,
  Messages
>;

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}
